export default class /* implements ICognitoStorage */ {
  constructor(storage, clientId) {
    this.storage = storage;
    this.clientId = clientId;
  }

  setItem(key, value) {
    this.storage.setUniversal(key, value);
  }

  getItem(key) {
    return this.storage.getUniversal(key);
  }

  removeItem(key) {
    this.storage.removeUniversal(key);
  }

  clear() {
    let prefix = `auth.CognitoIdentityServiceProvider.${this.clientId}.`;
    const lastAuthUser = this.getItem(prefix + "LastAuthUser");
    
    if (!lastAuthUser) {
      return;
    }

    this.removeItem(prefix + "LastAuthUser");
    ["accessToken", "clockDrift", "idToken", "refreshToken"]
      .map((name) => `${prefix}${lastAuthUser}.${name}`)
      .map((name) => this.removeItem(name));
  }
}
