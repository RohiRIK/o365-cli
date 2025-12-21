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
const mockSelect = mock().mockReturnThis();
const mockExpand = mock().mockReturnThis();
const mockGet = mock();
const mockPost = mock();
const mockUpdate = mock();
const mockDelete = mock();

mockApi.mockImplementation(() => ({
  select: mockSelect,
  expand: mockExpand,
  get: mockGet,
  post: mockPost,
  update: mockUpdate,
  delete: mockDelete,
}));

// Spy on IPC
const mockSuccess = mock();
const mockError = mock();
const mockProgress = mock();

describe("IAM Offboarding Worker", () => {
  beforeEach(() => {
    // Reset mocks
    mockApi.mockClear();
    mockGet.mockClear();
    mockPost.mockClear();
    mockUpdate.mockClear();
    mockDelete.mockClear();
    mockSuccess.mockClear();
    mockError.mockClear();
    mockProgress.mockClear();

    // Setup basic mocks
    GraphService.getClient = mock(() => mockClient as any);
    IPC.success = mockSuccess;
    IPC.error = mockError;
    IPC.progress = mockProgress;
  });

  it("should report error if user is not found", async () => {
    mockGet.mockResolvedValue(null); // User not found
    await offboardUser("nonexistent@company.com");
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining("not found"));
  });

  it("should perform dry-run actions correctly", async () => {
    mockGet.mockResolvedValueOnce({
      id: "user-123",
      displayName: "Test User",
      userPrincipalName: "test@company.com",
      accountEnabled: true,
      assignedLicenses: [{ skuId: "license-1" }],
      manager: { displayName: "Boss", userPrincipalName: "boss@company.com" }
    });
    mockGet.mockResolvedValueOnce({ value: [{ id: "dev-1", deviceName: "Laptop", operatingSystem: "Windows" }] });
    mockGet.mockResolvedValueOnce({ value: [] }); // License details

    await offboardUser("test@company.com", undefined, true);

    expect(mockSuccess).toHaveBeenCalled();
    const result = mockSuccess.mock.calls[0][0];
    const rows = result.table.rows;
    expect(rows.some((r: string[]) => r[0] === "DRY-RUN" && r[1].includes("disable sign-in"))).toBe(true);
  });

  it("should handle group-based license removal fallback", async () => {
    // 1. Mock user
    mockGet.mockResolvedValueOnce({
      id: "user-123",
      displayName: "Test User",
      accountEnabled: false,
      assignedLicenses: [{ skuId: "license-group" }],
    });

    // 2. Mock devices
    mockGet.mockResolvedValueOnce({ value: [] }); 

    // 3. Mock license details
    mockGet.mockResolvedValueOnce({ value: [] }); 

    // Fail direct removal (Queue: 1. Revoke=Success, 2. AssignLicense=Fail)
    mockPost.mockResolvedValueOnce({});
    mockPost.mockRejectedValueOnce(new Error("User license is inherited from a group membership"));

    // 4. Mock group membership
    mockGet.mockResolvedValueOnce({ 
        value: [{ id: "group-1", displayName: "Licensing Group" }] 
    });

    // Execute LIVE run
    await offboardUser("test@company.com", undefined, false);

    // Verify group removal was attempted
    expect(mockDelete).toHaveBeenCalled();
    
    const result = mockSuccess.mock.calls[0][0];
    const rows = result.table.rows;
    expect(rows.some((r: string[]) => r[0] === "SUCCESS" && r[1].includes("Removed from group"))).toBe(true);
  });
});