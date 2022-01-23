import Amplify from '@aws-amplify/core'
import Auth from '@aws-amplify/auth'
import Token from './token'
import RefreshToken from './refreshToken'
import RequestHandler from '@nuxtjs/auth-next/dist/inc/request-handler'
import RefreshController from '@nuxtjs/auth-next/dist/inc/refresh-controller'
import ExpiredAuthSessionError from '@nuxtjs/auth-next/dist/inc/expired-auth-session-error'
import BaseScheme from '@nuxtjs/auth-next/dist/schemes/_scheme'
import { getResponseProp } from '@nuxtjs/auth-next/dist/utils'
import storageWrapper from '../utils/storageWrapper'

const DEFAULTS = {
  name: 'cognito',
  tokenType: 'Bearer',
  globalToken: true,
  tokenRequired: true,
  tokenName: 'Authorization',
  autoLogout: false,
  token: {
    property: 'access_token',
    type: 'Bearer',
    name: 'Authorization',
    maxAge: 1800,
    global: true,
    expirationPrefix: '_token_expiration.'
  },
  refreshToken: {
    property: 'refresh_token',
    maxAge: 60 * 60 * 24 * 30,
    expirationPrefix: '_refresh_token_expiration.'
  },
  user: {
    property: 'data',
    autoFetch: true
  },
  credentials: {}
}

export default class CognitoAuthScheme extends BaseScheme {
  constructor($auth, options, ...defaults) {
    super($auth, options, ...defaults, DEFAULTS)

    // Init universal storage
    this.storage = new storageWrapper(
      this.$auth.$storage,
      this.options.credentials.userPoolWebClientId
    )

    // Configure AWS
    Amplify.configure({
      Auth: {
        ...this.options.credentials,
        storage: this.storage
      }
    })

    this.token = null
    this.refreshToken = null
    this.requestHandler = new RequestHandler(this, this.$auth.ctx.$axios)
    this.refreshController = new RefreshController(this)
  }

  check(checkStatus = false) {
    const response = {
      valid: false,
      tokenExpired: false,
      refreshTokenExpired: false,
      isRefreshable: true
    }

    // Sync tokens
    const token = this.token.sync()
    this.refreshToken.sync()

    // Token is required but not available
    if (!token) {
      return response
    }

    // Check status wasn't enabled, let it pass
    if (!checkStatus) {
      response.valid = true
      return response
    }

    // Get status
    const tokenStatus = this.token.status()
    const refreshTokenStatus = this.refreshToken.status()

    // Tokens status is unknown. Force reset
    if (refreshTokenStatus.unknown() || tokenStatus.unknown()) {
      return response
    }

    // Refresh token has expired. There is no way to refresh. Force reset.
    if (refreshTokenStatus.expired()) {
      response.refreshTokenExpired = true
      return response
    }

    // Token has expired, Force reset.
    if (tokenStatus.expired()) {
      response.tokenExpired = true
      return response
    }

    response.valid = true

    return response
  }

  async mounted() {
    let session

    try {
      // Get Cognito Session
      session = await this._getCognitoSession()
    } catch (e) {
      // error handler placeholder
    }

    // Reset auth if no session
    if (!session) {
      this.$auth.reset()
      return
    }

    this._initTokens(session)

    const { tokenExpired, refreshTokenExpired } = this.check(true)

    // Force reset if refresh token has expired
    // Or if `autoLogout` is enabled and token has expired
    if (refreshTokenExpired || (tokenExpired && this.options.autoLogout)) {
      this.$auth.reset()
    }

    // Initialize request interceptor
    this.requestHandler.initializeRequestInterceptor(
      this.options.endpoints.token
    )

    return this.$auth.fetchUserOnce()
  }

  async login({ data }) {
    // logout and reset auth
    await this.logout()

    // Sign in AWS Cognito service
    const user = await Auth.signIn(data.username, data.password)
    const session = user.getSignInUserSession()

    // Set tokens
    this._initTokens(session)

    // Fetch user if `autoFetch` is enabled
    if (this.options.user.autoFetch) {
      await this.fetchUser()
    }

    return session
  }

  _initTokens(session) {
    if (!this.token) {
      this.token = new Token(session, this, this.$auth.$storage)
    }

    if (!this.refreshToken) {
      this.refreshToken = new RefreshToken(session, this, this.$auth.$storage)
    }
  }

  _updateTokens(session) {
    if (!session) {
      throw new Error('Session error')
    }

    this.token = new Token(session, this, this.$auth.$storage)
    this.refreshToken = new RefreshToken(session, this, this.$auth.$storage)
  }

  async refreshTokens() {
    // Get refresh token
    const refreshToken = this.refreshToken.get()

    // Refresh token is required but not available
    if (!refreshToken) {
      return
    }

    // Get refresh token status
    const refreshTokenStatus = this.refreshToken.status()

    // Refresh token is expired. There is no way to refresh. Force reset.
    if (refreshTokenStatus.expired()) {
      this.$auth.reset()
      throw new ExpiredAuthSessionError()
    }

    // Delete current token from the request header before refreshing
    this.requestHandler.clearHeader()

    // Refresh AWS session
    await this._refreshSession()

    // Get current user session
    const session = await this._getCognitoSession()

    // update tokens
    this._updateTokens(session)

    return session
  }

  async fetchUser() {
    // Token is required but not available
    if (!this.check().valid) {
      return
    }

    let cognitoUser = null

    // Try to get the current pool user
    try {
      cognitoUser = await this._getCognitoUser()
    } catch (e) {
      // error handler placeholder
    }

    // Skip if no cognito user is logged in
    if (cognitoUser === null) {
      return
    }

    let user = {}

    // cognito user info
    user.cognito = {
      username: cognitoUser.username
    }

    // User endpoint is disabled
    if (!this.options.endpoints.user) {
      this.$auth.setUser(user)
      return
    }

    // Try to fetch user and then set
    return this.$auth
      .requestWith(this.name, {}, this.options.endpoints.user)
      .then((response) => {
        this.$auth.setUser({
          ...user,
          ...(getResponseProp(response, this.options.user.property) || {})
        })

        return response
      })
      .catch((error) => {
        this.$auth.callOnError(error, { method: 'fetchUser' })
        return Promise.reject(error)
      })
  }

  async logout() {
    // Sign out from AWS
    await Auth.signOut()

    // Reset auth data
    return this.$auth.reset()
  }

  reset() {
    this.$auth.setUser(false);

    // Reset id token
    if (this.token) {
      this.token.reset()
      this.token = null
    }

    // Reset refresh token
    if (this.refreshToken) {
      this.refreshToken.reset()
      this.refreshToken = null
    }

    this.requestHandler.reset()
  }

  async _getCognitoUser() {
    return await Auth.currentAuthenticatedUser()
  }

  async _getCognitoSession() {
    return await Auth.currentSession()
  }

  async _refreshSession() {
    const user = await this._getCognitoUser()
    const { refreshToken } = user.getSignInUserSession()

    user.refreshSession(refreshToken, async (err, newSession) => {
      if (err) {
        throw new Error(err)
      }
    })

    return
  }
}
