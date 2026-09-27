import keytar from "keytar";

export class TokenStorage {
  private serviceName: string;

  constructor(serviceName: string = "o365-cli") {
    this.serviceName = serviceName;
  }

  async saveToken(account: string, token: string): Promise<void> {
    await keytar.setPassword(this.serviceName, account, token);
  }

  async getToken(account: string): Promise<string | null> {
    return await keytar.getPassword(this.serviceName, account);
  }

  async deleteToken(account: string): Promise<boolean> {
    return await keytar.deletePassword(this.serviceName, account);
  }
}
