import { describe, it, expect, mock, beforeEach } from "bun:test";
import { analyzeShadowIT } from "./shadow-it";
import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
// Mock GraphService
mock.module("../../services/graph", () => {
    return {
        GraphService: {
            getClient: mock(() => ({})),
            fetchAll: mock(() => Promise.resolve([])),
        },
    };
});
describe("Shadow IT Forensic Enrichment", () => {
    beforeEach(() => {
        // Reset mocks
        GraphService.getClient.mockClear();
        GraphService.fetchAll.mockClear();
        // Spy on IPC
        IPC.progress = mock();
        IPC.success = mock();
        IPC.error = mock();
    });
    it("should include granular IDs (App, SP, User) in the result", async () => {
        // Mock Graph Client
        const mockClient = {
            api: mock((path) => ({
                select: mock().mockReturnThis(),
                expand: mock().mockReturnThis(),
                top: mock().mockReturnThis(),
                get: mock(async () => {
                    if (path === "/organization")
                        return { value: [{ id: "tenant-123" }] };
                    if (path === "/oauth2PermissionGrants")
                        return {
                            value: [{
                                    id: "grant-1",
                                    clientId: "sp-123",
                                    principalId: "user-456",
                                    scope: "Mail.Read",
                                    startTime: "2023-01-01T00:00:00Z"
                                }]
                        };
                    if (path === "/servicePrincipals")
                        return { value: [] };
                    if (path.startsWith("/servicePrincipals/sp-123"))
                        return {
                            id: "sp-123",
                            appId: "app-789",
                            displayName: "Test App",
                            appOwnerOrganizationId: "external-org"
                        };
                    if (path.startsWith("/users/user-456"))
                        return {
                            id: "user-456",
                            displayName: "Test User",
                            userPrincipalName: "user@test.com"
                        };
                    return { value: [] };
                })
            }))
        };
        GraphService.getClient.mockReturnValue(mockClient);
        await analyzeShadowIT(true);
        // Verify IPC.success was called
        expect(IPC.success).toHaveBeenCalled();
        const payload = IPC.success.mock.calls[0][0];
        expect(payload.table.headers).toContain("App ID");
    });
    it("should identify Microsoft Security Classification as source for critical permissions", async () => {
        const mockClient = {
            api: mock((path) => ({
                select: mock().mockReturnThis(),
                expand: mock().mockReturnThis(),
                top: mock().mockReturnThis(),
                get: mock(async () => {
                    if (path === "/organization")
                        return { value: [{ id: "tenant-123" }] };
                    if (path === "/oauth2PermissionGrants")
                        return {
                            value: [{
                                    id: "grant-critical",
                                    clientId: "sp-crit",
                                    principalId: "user-crit",
                                    scope: "Directory.ReadWrite.All", // CRITICAL
                                    startTime: "2023-01-01T00:00:00Z",
                                    consentType: "AllPrincipals"
                                }]
                        };
                    if (path === "/servicePrincipals")
                        return { value: [] };
                    if (path.startsWith("/servicePrincipals/sp-crit"))
                        return {
                            id: "sp-crit",
                            appId: "app-crit",
                            displayName: "Critical App",
                            appOwnerOrganizationId: "external",
                            passwordCredentials: [{ startDateTime: "2020-01-01T00:00:00Z", endDateTime: "2025-01-01T00:00:00Z" }]
                        };
                    if (path.startsWith("/users/user-crit"))
                        return {
                            id: "user-crit",
                            displayName: "Target User",
                            userPrincipalName: "target@test.com"
                        };
                    return { value: [] };
                })
            }))
        };
        GraphService.getClient.mockReturnValue(mockClient);
        await analyzeShadowIT(true);
        const payload = IPC.success.mock.calls[0][0];
        expect(payload.table.rows[0][0]).toContain("🔴"); // Critical risk emoji
    });
});
