export interface AnalysisResult {
  id: string;
  name: string;
  description: string;
  status: "pass" | "fail" | "warn";
  recommendation: string;
}

export class CABaselineAnalyzer {
  private readonly baseline = [
    {
      id: "block-legacy-auth",
      name: "Block Legacy Authentication",
      description: "Ensure legacy authentication protocols (EAS, POP, IMAP) are blocked.",
      check: (policies: any[]) => policies.some(p => 
        p.state === "enabled" && 
        p.conditions?.clientAppTypes?.some((t: string) => ["exchangeActiveSync", "other"].includes(t)) &&
        p.grantControls?.builtInControls?.includes("block")
      ),
      recommendation: "Create a CA policy targeting all users, selecting 'Legacy Authentication' clients, and setting the access control to 'Block'."
    },
    {
      id: "mfa-admins",
      name: "MFA for Privileged Roles",
      description: "Require MFA for users with administrative roles.",
      check: (policies: any[]) => policies.some(p => 
        p.state === "enabled" && 
        (p.conditions?.users?.includeRoles?.length > 0 || p.conditions?.users?.includeUsers?.includes("All")) &&
        p.grantControls?.builtInControls?.includes("mfa")
      ),
      recommendation: "Create a CA policy targeting 'Directory Roles' (Global Admin, etc.) and requiring MFA."
    },
    {
      id: "require-mfa-all",
      name: "MFA for All Users",
      description: "Ensure all users are prompted for MFA for cloud apps.",
      check: (policies: any[]) => policies.some(p => 
        p.state === "enabled" && 
        p.conditions?.users?.includeUsers?.includes("All") &&
        p.grantControls?.builtInControls?.includes("mfa")
      ),
      recommendation: "Create a broad MFA policy targeting 'All Users' and 'All Cloud Apps'."
    }
  ];

  /**
   * Performs gap analysis against the defined baseline
   */
  analyze(policies: any[]): AnalysisResult[] {
    return this.baseline.map(rule => {
      const passed = rule.check(policies);
      return {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        status: passed ? "pass" : "fail",
        recommendation: rule.recommendation
      };
    });
  }
}
