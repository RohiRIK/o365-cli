import { describe, it, expect, mock, beforeEach } from "bun:test";
import { GraphService } from "./graph";

describe("GraphService", () => {
  beforeEach(() => {
    // Mock token
    (GraphService as any).token = "test-token";
    // Clear instance to force re-init
    (GraphService as any).instance = null;
  });

  it("should provide a fetchAll method that handles pagination", async () => {
    expect(GraphService.fetchAll).toBeDefined();
    
    // Mock the client instance
    const mockClient = {
      api: mock((path: string) => ({
        version: mock().mockReturnThis(),
        select: mock().mockReturnThis(),
        filter: mock().mockReturnThis(),
        expand: mock().mockReturnThis(),
        top: mock().mockReturnThis(),
        get: mock(async () => {
          if (path === "/test") {
            return {
              value: [{ id: 1 }],
              "@odata.nextLink": "https://graph.microsoft.com/v1.0/test?skip=1"
            };
          } else {
            return {
              value: [{ id: 2 }]
            };
          }
        })
      }))
    };

    (GraphService as any).instance = mockClient;

    const results = await GraphService.fetchAll("/test");
    
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe(1);
    expect(results[1].id).toBe(2);
  });
});