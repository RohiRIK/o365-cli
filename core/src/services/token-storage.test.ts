import { describe, it, expect, mock } from "bun:test";
import { TokenStorage } from "./token-storage";

// Mock keytar module
mock.module("keytar", () => {
  const store = new Map<string, string>();
  return {
    default: {
      setPassword: (service: string, account: string, password: string) => {
        store.set(`${service}:${account}`, password);
        return Promise.resolve();
      },
      getPassword: (service: string, account: string) => {
        return Promise.resolve(store.get(`${service}:${account}`) || null);
      },
      deletePassword: (service: string, account: string) => {
        return Promise.resolve(store.delete(`${service}:${account}`));
      }
    }
  };
});

describe("TokenStorage", () => {
  it("should save and retrieve a token", async () => {
    const storage = new TokenStorage("test-service");
    await storage.saveToken("user1", "secret123");
    
    const retrieved = await storage.getToken("user1");
    expect(retrieved).toBe("secret123");
  });

  it("should return null for non-existent token", async () => {
    const storage = new TokenStorage("test-service");
    const retrieved = await storage.getToken("non-existent");
    expect(retrieved).toBeNull();
  });

  it("should delete a token", async () => {
    const storage = new TokenStorage("test-service");
    await storage.saveToken("user2", "secret456");
    
    const deleted = await storage.deleteToken("user2");
    expect(deleted).toBe(true);
    
    const retrieved = await storage.getToken("user2");
    expect(retrieved).toBeNull();
  });
});
