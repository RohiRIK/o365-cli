import { describe, it, expect, mock, beforeEach } from "bun:test";
import { analyzeShadowIT } from "./shadow-it";
import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

describe("Shadow IT Forensic Enrichment", () => {
  beforeEach(() => {
    // Reset mocks
    mock.restore();
    (GraphService as any).instance = null;
    (GraphService as any).token = "test-token";
    
    // Spy on IPC
    IPC.progress = mock();
    IPC.success = mock();
    IPC.error = mock();
  });

  it("should include granular IDs (App, SP, User) in the result", async () => {
    // Mock Graph Client
    const mockClient = {
      api: mock((path: string) => ({
        select: mock().mockReturnThis(),
        expand: mock().mockReturnThis(),
        top: mock().mockReturnThis(),
        get: mock(async () => {
          if (path === "/organization") return { value: [{ id: "tenant-123" }] };
          if (path === "/oauth2PermissionGrants") return { 
            value: [{ 
              id: "grant-1", 
              clientId: "sp-123", 
              principalId: "user-456", 
              scope: "Mail.Read",
              startTime: "2023-01-01T00:00:00Z"
            }] 
          };
          if (path === "/servicePrincipals") return { value: [] };
          if (path.startsWith("/servicePrincipals/sp-123")) return {
            id: "sp-123",
            appId: "app-789",
            displayName: "Test App",
            appOwnerOrganizationId: "external-org"
          };
          if (path.startsWith("/users/user-456")) return {
            id: "user-456",
            displayName: "Test User",
            userPrincipalName: "user@test.com"
          };
          return { value: [] };
        })
      }))
    };
    
    (GraphService as any).instance = mockClient;

    await analyzeShadowIT(true);

    // Verify IPC.success was called
    expect(IPC.success).toHaveBeenCalled();
    const payload = (IPC.success as any).mock.calls[0][0];
    
    // RED PHASE: We expect these fields to be in the "RiskyGrant" data (even if implicitly in the table for now)
    // Actually, let's verify if the logic fetches them.
    // For now, I'll just check if the test fails to compile or run as expected if I were to check internal state.
    // But since RiskyGrant is internal, I'll check if the headers/rows in the table (which is the output) 
    // eventually get updated.
    
    // For the "Red Phase", I'll assert on something that DEFINITELY isn't there yet.
    expect(payload.table.headers).toContain("App ID");
  });
});
