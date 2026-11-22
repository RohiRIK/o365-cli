import { describe, it, expect, mock, beforeEach } from "bun:test";
import { cleanupGuests } from "./guest-cleanup";
import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
// Mocks
const mockFetchAll = mock();
const mockUpdate = mock();
const mockApi = mock(() => ({
    update: mockUpdate
}));
const mockClient = {
    api: mockApi
};
describe("IAM Guest Cleanup Worker", () => {
    beforeEach(() => {
        mockFetchAll.mockClear();
        mockUpdate.mockClear();
        mockApi.mockClear();
        GraphService.fetchAll = mockFetchAll;
        GraphService.getClient = mock(() => mockClient);
        IPC.progress = mock();
        IPC.success = mock();
        IPC.error = mock();
    });
    it("should flag stale guest users (>90 days)", async () => {
        const now = new Date();
        const staleDate = new Date();
        staleDate.setDate(now.getDate() - 100);
        mockFetchAll.mockResolvedValue([
            {
                id: "stale-1",
                displayName: "Stale Guest",
                userPrincipalName: "stale@guest.com",
                accountEnabled: true,
                signInActivity: { lastSignInDateTime: staleDate.toISOString() },
                manager: { displayName: "Sponsor" }
            }
        ]);
        await cleanupGuests(90, true);
        const successCall = IPC.success.mock.calls[0][0];
        expect(successCall.table.rows[0][3]).toContain("Stale: Last sign-in 100 days ago");
        expect(successCall.table.rows[0][3]).toContain("[DRY-RUN] Would block sign-in");
    });
    it("should flag guests without sponsors", async () => {
        mockFetchAll.mockResolvedValue([
            {
                id: "nosponsor-1",
                displayName: "No Sponsor Guest",
                userPrincipalName: "nosponsor@guest.com",
                accountEnabled: true,
                signInActivity: { lastSignInDateTime: new Date().toISOString() },
                manager: null
            }
        ]);
        await cleanupGuests(90, true);
        const successCall = IPC.success.mock.calls[0][0];
        expect(successCall.table.rows[0][3]).toContain("No assigned sponsor/manager found");
    });
    it("should execute block in live mode", async () => {
        mockFetchAll.mockResolvedValue([
            {
                id: "live-1",
                displayName: "Live Target",
                userPrincipalName: "live@guest.com",
                accountEnabled: true,
                manager: null
            }
        ]);
        mockUpdate.mockResolvedValue({});
        await cleanupGuests(90, false);
        expect(mockUpdate).toHaveBeenCalledWith({ accountEnabled: false });
        expect(mockApi).toHaveBeenCalledWith("/users/live-1");
    });
});
