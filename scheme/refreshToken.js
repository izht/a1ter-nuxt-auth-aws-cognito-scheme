import jwtDecode, { InvalidTokenError } from 'jwt-decode'
import TokenStatus from '@nuxtjs/auth-next/dist/inc/token-status'

export default class RefreshToken {
  constructor(session, scheme, storage) {
    if (!session) {
      throw new Error('Cognito user session is required')
    }

    this.session = session
    this.scheme = scheme
    this.$storage = storage

    this._update()
  }

  _getExpiration() {
    const _key =
      this.scheme.options.refreshToken.expirationPrefix + this.scheme.name
    return this.$storage.getUniversal(_key)
  }

  _setExpiration(expiration) {
    const _key =
      this.scheme.options.refreshToken.expirationPrefix + this.scheme.name
    return this.$storage.setUniversal(_key, expiration)
  }

  _syncExpiration() {
    const _key =
      this.scheme.options.refreshToken.expirationPrefix + this.scheme.name
    return this.$storage.syncUniversal(_key)
  }

  _updateExpiration(refreshToken) {
    let refreshTokenExpiration
    const _tokenIssuedAtMillis = Date.now()
    const _tokenTTLMillis = this.scheme.options.refreshToken.maxAge * 1000
    const _tokenExpiresAtMillis = _tokenTTLMillis
      ? _tokenIssuedAtMillis + _tokenTTLMillis
      : 0

    try {
      refreshTokenExpiration =
        jwtDecode(refreshToken).exp * 1000 || _tokenExpiresAtMillis
    } catch (error) {
      // If the token is not jwt, we can't decode and refresh it, use _tokenExpiresAt value
      refreshTokenExpiration = _tokenExpiresAtMillis
      if (!(error instanceof InvalidTokenError)) {
        throw error
      }
    }

    // Set token expiration
    return this._setExpiration(refreshTokenExpiration || false)
  }

  _update() {
    const type = this.scheme.options.refreshToken.type
    const token = (type ? type + ' ' : '') + this._getToken

    this._updateExpiration(token)
    return token
  }

  get _getToken() {
    return this.session.refreshToken.token
  }

  set() {
    return this._update()
  }

  sync() {
    const token = this.get()

    this._syncExpiration()
    return token
  }

  reset() {
    this._setExpiration(false)
  }

  status() {
    return new TokenStatus(this.get(), this._getExpiration())
  }

  get() {
    return this._getToken
  }
}
