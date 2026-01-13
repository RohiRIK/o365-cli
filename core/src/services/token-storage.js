import keytar from "keytar";
export class TokenStorage {
    serviceName;
    constructor(serviceName = "o365-cli") {
        this.serviceName = serviceName;
    }
    async saveToken(account, token) {
        await keytar.setPassword(this.serviceName, account, token);
    }
    async getToken(account) {
        return await keytar.getPassword(this.serviceName, account);
    }
    async deleteToken(account) {
        return await keytar.deletePassword(this.serviceName, account);
    }
}
