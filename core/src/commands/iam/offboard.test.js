import { describe, it, expect, mock, beforeEach } from "bun:test";
import { offboardUser } from "./offboard";
import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";
// Mocks
const mockGet = mock();
const mockPost = mock();
const mockUpdate = mock();
const mockDelete = mock();
const mockChain = {
    select: mock().mockReturnThis(),
    expand: mock().mockReturnThis(),
    filter: mock().mockReturnThis(),
    get: mockGet,
    post: mockPost,
    update: mockUpdate,
    delete: mockDelete,
};
const mockClient = {
    api: mock((url) => mockChain),
};
// Spy on IPC
const mockSuccess = mock();
const mockError = mock();
const mockProgress = mock();
const mockLog = mock();
describe("IAM Offboarding Worker", () => {
    beforeEach(() => {
        mockGet.mockClear();
        mockPost.mockClear();
        mockUpdate.mockClear();
        mockDelete.mockClear();
        mockSuccess.mockClear();
        mockError.mockClear();
        mockProgress.mockClear();
        mockLog.mockClear();
        GraphService.getClient = mock(() => mockClient);
        IPC.success = mockSuccess;
        IPC.error = mockError;
        IPC.progress = mockProgress;
        IPC.log = mockLog;
    });
    it("should report error if user is not found", async () => {
        mockGet.mockResolvedValue(null);
        await offboardUser("nonexistent@company.com", undefined, true, "none");
        expect(mockError).toHaveBeenCalled();
    });
    it("should perform dry-run actions correctly", async () => {
        // 1. Discovery
        mockGet.mockResolvedValueOnce({
            id: "u1",
            displayName: "Test User",
            accountEnabled: true,
            assignedLicenses: [{ skuId: "s1" }]
        });
        // 2. Intune Devices (Skip)
        // 3. Entra Devices (Skip)
        // 4. Group memberships check
        mockGet.mockResolvedValueOnce({ value: [] });
        await offboardUser("test@company.com", undefined, true, "none");
        expect(mockSuccess).toHaveBeenCalled();
        const result = mockSuccess.mock.calls[0][0];
        expect(result.table.rows.some((r) => r[0] === "DRY-RUN")).toBe(true);
    });
    it("should handle group-based license removal", async () => {
        // 1. Discovery
        mockGet.mockResolvedValueOnce({
            id: "u1",
            displayName: "Test",
            accountEnabled: true,
            assignedLicenses: [{ skuId: "s1" }]
        });
        // 2. Lockdown Update
        mockUpdate.mockResolvedValueOnce({});
        // 3. Revoke Sessions
        mockPost.mockResolvedValueOnce({});
        // 4. OOF Update
        mockUpdate.mockResolvedValueOnce({});
        // 5. Convert Mailbox
        mockPost.mockResolvedValueOnce({});
        // 6. Groups Fetch
        mockGet.mockResolvedValueOnce({ value: [{ id: "g1", displayName: "Group" }] });
        // 7. Group Delete
        mockDelete.mockResolvedValueOnce({});
        // 8. License Removal
        mockPost.mockResolvedValueOnce({});
        await offboardUser("test@company.com", undefined, false, "none");
        expect(mockDelete).toHaveBeenCalled();
        expect(mockSuccess).toHaveBeenCalled();
    });
});
