import { describe, it, expect } from "bun:test";
import { AuthService } from "./auth";
describe("AuthService", () => {
    it("should generate a valid PKCE challenge and verifier", () => {
        const { verifier, challenge } = AuthService.generatePKCE();
        expect(verifier).toBeString();
        expect(verifier.length).toBeGreaterThan(40);
        expect(challenge).toBeString();
        expect(challenge.length).toBeGreaterThan(0);
    });
    it("should construct a valid authorization URL", () => {
        const auth = new AuthService("test-tenant");
        const { verifier, challenge } = AuthService.generatePKCE();
        const url = auth.getAuthorizationUrl(challenge, "state-123");
        expect(url).toContain("https://login.microsoftonline.com/test-tenant/oauth2/v2.0/authorize");
        expect(url).toContain("client_id=");
        expect(url).toContain("response_type=code");
        expect(url).toContain("code_challenge=" + challenge);
        expect(url).toContain("code_challenge_method=S256");
        expect(url).toContain("state=state-123");
    });
});
