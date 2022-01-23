import jwtDecode, { InvalidTokenError } from 'jwt-decode'
import TokenStatus from '@nuxtjs/auth-next/dist/inc/token-status'

export default class Token {
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
    const _key = this.scheme.options.token.expirationPrefix + this.scheme.name
    return this.$storage.getUniversal(_key)
  }

  _setExpiration(expiration) {
    const _key = this.scheme.options.token.expirationPrefix + this.scheme.name
    return this.$storage.setUniversal(_key, expiration)
  }

  _syncExpiration() {
    const _key = this.scheme.options.token.expirationPrefix + this.scheme.name
    return this.$storage.syncUniversal(_key)
  }

  _updateExpiration(token) {
    let tokenExpiration
    const _tokenIssuedAtMillis = Date.now()
    const _tokenTTLMillis = this.scheme.options.token.maxAge * 1000
    const _tokenExpiresAtMillis = _tokenTTLMillis
      ? _tokenIssuedAtMillis + _tokenTTLMillis
      : 0
    try {
      tokenExpiration = jwtDecode(token).exp * 1000 || _tokenExpiresAtMillis
    } catch (error) {
      // If the token is not jwt, we can't decode and refresh it, use _tokenExpiresAt value
      tokenExpiration = _tokenExpiresAtMillis
      if (!(error instanceof InvalidTokenError)) {
        throw error
      }
    }

    // Set token expiration
    return this._setExpiration(tokenExpiration || false)
  }

  _update() {
    const type = this.scheme.options.token.type
    const token = (type ? type + ' ' : '') + this._getToken

    this.scheme.requestHandler.setHeader(token)
    this._updateExpiration(token)

    return token
  }

  get _getToken() {
    return this.session.getIdToken().getJwtToken()
  }

  set() {
    return this._update()
  }

  sync() {
    const type = this.scheme.options.token.type
    const token = (type ? type + ' ' : '') + this._getToken

    this.scheme.requestHandler.setHeader(token)
    this._syncExpiration()

    return token
  }

  reset() {
    this._setExpiration(false)
    this.scheme.requestHandler.clearHeader()
  }

  status() {
    return new TokenStatus(this.get(), this._getExpiration())
  }

  get() {
    return this._getToken
  }
}
