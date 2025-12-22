import { describe, it, expect, mock, beforeEach } from "bun:test";
import { offboardUser } from "./offboard";
import { GraphService } from "../../services/graph";
import { IPC } from "../../utils/ipc";

// Mocks
const mockApi = mock();
const mockClient = {
  api: mockApi,
};

// Mock chainable methods
const mockChain = {
  select: mock().mockReturnThis(),
  expand: mock().mockReturnThis(),
  filter: mock().mockReturnThis(),
  get: mock(),
  post: mock(),
  update: mock(),
  delete: mock(),
};

mockApi.mockImplementation(() => mockChain);

// Spy on IPC
const mockSuccess = mock();
const mockError = mock();
const mockProgress = mock();
const mockLog = mock();

describe("IAM Offboarding Worker", () => {
  beforeEach(() => {
    // Reset mocks
    mockApi.mockClear();
    Object.values(mockChain).forEach(m => m.mockClear());
    mockSuccess.mockClear();
    mockError.mockClear();
    mockProgress.mockClear();
    mockLog.mockClear();

    // Setup basic mocks
    GraphService.getClient = mock(() => mockClient as any);
    IPC.success = mockSuccess;
    IPC.error = mockError;
    IPC.progress = mockProgress;
    IPC.log = mockLog;
  });

  it("should report error if user is not found", async () => {
    mockChain.get.mockResolvedValue(null); // User not found
    await offboardUser("nonexistent@company.com");
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining("not found"));
  });

  it("should perform dry-run actions correctly", async () => {
    mockChain.get.mockResolvedValueOnce({
      id: "user-123",
      displayName: "Test User",
      userPrincipalName: "test@company.com",
      accountEnabled: true,
      showInAddressList: true,
      assignedLicenses: [{ skuId: "license-1" }],
      manager: { displayName: "Boss", userPrincipalName: "boss@company.com" }
    });
    mockChain.get.mockResolvedValueOnce({ value: [{ id: "dev-intune-1", deviceName: "Laptop", operatingSystem: "Windows" }] });
    mockChain.get.mockResolvedValueOnce({ value: [{ id: "dev-entra-1", displayName: "Phone", operatingSystem: "iOS", accountEnabled: true }] });

    await offboardUser("test@company.com", undefined, true);

    expect(mockSuccess).toHaveBeenCalled();
    const result = mockSuccess.mock.calls[0][0];
    const rows = result.table.rows;
    expect(rows.some((r: string[]) => r[0] === "DRY-RUN" && r[1].includes("disable sign-in and hide"))).toBe(true);
    expect(rows.some((r: string[]) => r[0] === "DRY-RUN" && r[1].includes("Retire Intune device"))).toBe(true);
    expect(rows.some((r: string[]) => r[0] === "DRY-RUN" && r[1].includes("Disable Entra ID device"))).toBe(true);
  });

  it("should handle group-based license removal fallback", async () => {
    // 1. User search
    mockChain.get.mockResolvedValueOnce({
      id: "user-123",
      displayName: "Test User",
      accountEnabled: false,
      showInAddressList: false,
      assignedLicenses: [{ skuId: "license-group" }],
    });

    // 2. Intune devices
    mockChain.get.mockResolvedValueOnce({ value: [] }); 
    // 3. Entra devices
    mockChain.get.mockResolvedValueOnce({ value: [] }); 

    // 4. Revoke sessions
    mockChain.post.mockResolvedValueOnce({}); 

    // 5. Direct license removal (FAIL)
    mockChain.post.mockRejectedValueOnce(new Error("User license is inherited from a group membership"));

    // 6. Fetch group membership
    mockChain.get.mockResolvedValueOnce({ 
        value: [{ id: "group-1", displayName: "Licensing Group" }] 
    });

    // 7. Delete group member
    mockChain.delete.mockResolvedValueOnce({});

    // Execute LIVE run
    await offboardUser("test@company.com", undefined, false);

    // Verify
    expect(mockChain.delete).toHaveBeenCalled();
    const result = mockSuccess.mock.calls[0][0];
    expect(result.table.rows.some((r: string[]) => r[1].includes("Removed from group"))).toBe(true);
  });
});
