const DEFAULT_THRESHOLDS = {
  checks: ["rate>0.95"],
  http_req_failed: ["rate<0.05"],
  http_req_duration: ["p(95)<2000", "p(99)<5000"],
  "http_req_failed{route_group:public}": ["rate<0.02"],
  "http_req_duration{route_group:public}": ["p(95)<1200", "p(99)<2500"],
  "http_req_failed{route_group:protected}": ["rate<0.05"],
  "http_req_duration{route_group:protected}": ["p(95)<1800", "p(99)<3500"],
  "http_req_failed{route_group:write}": ["rate<0.08"],
  "http_req_duration{route_group:write}": ["p(95)<3000", "p(99)<6000"],
  "http_req_failed{route_group:webhook}": ["rate<0.05"],
  "http_req_duration{route_group:webhook}": ["p(95)<1500", "p(99)<3000"],
};

const BASE_SUMMARY_STATS = ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"];

function boolEnv(name) {
  return __ENV[name] === "true" || __ENV[name] === "1";
}

function baseOptions() {
  return {
    thresholds: DEFAULT_THRESHOLDS,
    summaryTrendStats: BASE_SUMMARY_STATS,
    userAgent: "ButterGolf k6 suite/1.0",
    noConnectionReuse: false,
  };
}

function withOptionalScenarios(scenarios) {
  const nextScenarios = { ...scenarios };

  if (boolEnv("K6_ENABLE_WRITES")) {
    nextScenarios.write_flows = {
      executor: "constant-vus",
      exec: "writeFlows",
      vus: Number.parseInt(__ENV.K6_WRITE_VUS || "2", 10),
      duration: __ENV.K6_WRITE_DURATION || "2m",
      startTime: __ENV.K6_WRITE_START_TIME || "10s",
      gracefulStop: "20s",
    };
  }

  if (boolEnv("K6_ENABLE_WEBHOOKS")) {
    nextScenarios.webhook_resilience = {
      executor: "constant-vus",
      exec: "webhookResilience",
      vus: Number.parseInt(__ENV.K6_WEBHOOK_VUS || "1", 10),
      duration: __ENV.K6_WEBHOOK_DURATION || "1m",
      startTime: __ENV.K6_WEBHOOK_START_TIME || "10s",
      gracefulStop: "20s",
    };
  }

  return nextScenarios;
}

function smokeProfile() {
  return {
    ...baseOptions(),
    scenarios: withOptionalScenarios({
      public_browse: {
        executor: "shared-iterations",
        exec: "publicBrowse",
        vus: 1,
        iterations: 1,
        maxDuration: "2m",
      },
      protected_reads: {
        executor: "shared-iterations",
        exec: "protectedReads",
        vus: 1,
        iterations: 1,
        maxDuration: "2m",
        startTime: "5s",
      },
      unauthenticated_checks: {
        executor: "shared-iterations",
        exec: "unauthenticatedChecks",
        vus: 1,
        iterations: 1,
        maxDuration: "1m",
        startTime: "10s",
      },
    }),
  };
}

function loadProfile() {
  return {
    ...baseOptions(),
    scenarios: withOptionalScenarios({
      public_browse: {
        executor: "ramping-vus",
        exec: "publicBrowse",
        stages: [
          { duration: "1m", target: Number.parseInt(__ENV.K6_PUBLIC_VUS || "20", 10) },
          {
            duration: __ENV.K6_LOAD_DURATION || "5m",
            target: Number.parseInt(__ENV.K6_PUBLIC_VUS || "20", 10),
          },
          { duration: "1m", target: 0 },
        ],
        gracefulRampDown: "30s",
      },
      protected_reads: {
        executor: "ramping-vus",
        exec: "protectedReads",
        stages: [
          { duration: "1m", target: Number.parseInt(__ENV.K6_PROTECTED_VUS || "10", 10) },
          {
            duration: __ENV.K6_LOAD_DURATION || "5m",
            target: Number.parseInt(__ENV.K6_PROTECTED_VUS || "10", 10),
          },
          { duration: "1m", target: 0 },
        ],
        startTime: "20s",
        gracefulRampDown: "30s",
      },
    }),
  };
}

function spikeProfile() {
  return {
    ...baseOptions(),
    scenarios: withOptionalScenarios({
      public_browse: {
        executor: "ramping-vus",
        exec: "publicBrowse",
        stages: [
          { duration: "30s", target: 10 },
          { duration: "20s", target: Number.parseInt(__ENV.K6_SPIKE_VUS || "200", 10) },
          { duration: "1m", target: Number.parseInt(__ENV.K6_SPIKE_VUS || "200", 10) },
          { duration: "30s", target: 0 },
        ],
        gracefulRampDown: "30s",
      },
      protected_reads: {
        executor: "ramping-vus",
        exec: "protectedReads",
        stages: [
          { duration: "30s", target: 5 },
          { duration: "20s", target: Number.parseInt(__ENV.K6_SPIKE_PROTECTED_VUS || "75", 10) },
          { duration: "1m", target: Number.parseInt(__ENV.K6_SPIKE_PROTECTED_VUS || "75", 10) },
          { duration: "30s", target: 0 },
        ],
        startTime: "10s",
        gracefulRampDown: "30s",
      },
    }),
  };
}

function stressProfile() {
  return {
    ...baseOptions(),
    thresholds: {
      ...DEFAULT_THRESHOLDS,
      http_req_failed: ["rate<0.12"],
      http_req_duration: ["p(95)<4000", "p(99)<9000"],
    },
    scenarios: withOptionalScenarios({
      public_browse: {
        executor: "ramping-vus",
        exec: "publicBrowse",
        stages: [
          { duration: "2m", target: 25 },
          { duration: "3m", target: 75 },
          { duration: "3m", target: 150 },
          { duration: "3m", target: Number.parseInt(__ENV.K6_STRESS_VUS || "250", 10) },
          { duration: "2m", target: 0 },
        ],
        gracefulRampDown: "45s",
      },
      protected_reads: {
        executor: "ramping-vus",
        exec: "protectedReads",
        stages: [
          { duration: "2m", target: 10 },
          { duration: "3m", target: 30 },
          { duration: "3m", target: Number.parseInt(__ENV.K6_STRESS_PROTECTED_VUS || "75", 10) },
          { duration: "2m", target: 0 },
        ],
        startTime: "30s",
        gracefulRampDown: "45s",
      },
    }),
  };
}

function soakProfile() {
  return {
    ...baseOptions(),
    scenarios: withOptionalScenarios({
      public_browse: {
        executor: "constant-vus",
        exec: "publicBrowse",
        vus: Number.parseInt(__ENV.K6_SOAK_PUBLIC_VUS || "15", 10),
        duration: __ENV.K6_SOAK_DURATION || "30m",
        gracefulStop: "1m",
      },
      protected_reads: {
        executor: "constant-vus",
        exec: "protectedReads",
        vus: Number.parseInt(__ENV.K6_SOAK_PROTECTED_VUS || "8", 10),
        duration: __ENV.K6_SOAK_DURATION || "30m",
        startTime: "30s",
        gracefulStop: "1m",
      },
    }),
  };
}

function writesProfile() {
  return {
    ...baseOptions(),
    scenarios: {
      write_flows: {
        executor: "constant-vus",
        exec: "writeFlows",
        vus: Number.parseInt(__ENV.K6_WRITE_VUS || "2", 10),
        duration: __ENV.K6_WRITE_DURATION || "3m",
        gracefulStop: "30s",
      },
    },
  };
}

function webhooksProfile() {
  return {
    ...baseOptions(),
    scenarios: {
      webhook_resilience: {
        executor: "constant-vus",
        exec: "webhookResilience",
        vus: Number.parseInt(__ENV.K6_WEBHOOK_VUS || "2", 10),
        duration: __ENV.K6_WEBHOOK_DURATION || "2m",
        gracefulStop: "30s",
      },
    },
  };
}

function allProfile() {
  return {
    ...baseOptions(),
    scenarios: withOptionalScenarios({
      public_browse: {
        executor: "constant-vus",
        exec: "publicBrowse",
        vus: Number.parseInt(__ENV.K6_PUBLIC_VUS || "15", 10),
        duration: __ENV.K6_ALL_DURATION || "5m",
      },
      protected_reads: {
        executor: "constant-vus",
        exec: "protectedReads",
        vus: Number.parseInt(__ENV.K6_PROTECTED_VUS || "8", 10),
        duration: __ENV.K6_ALL_DURATION || "5m",
        startTime: "15s",
      },
      unauthenticated_checks: {
        executor: "constant-vus",
        exec: "unauthenticatedChecks",
        vus: 1,
        duration: __ENV.K6_ALL_DURATION || "5m",
        startTime: "30s",
      },
    }),
  };
}

export function getProfileName() {
  return (__ENV.K6_PROFILE || "smoke").toLowerCase();
}

export function buildOptions() {
  const profileName = getProfileName();

  switch (profileName) {
    case "load":
      return loadProfile();
    case "spike":
      return spikeProfile();
    case "stress":
      return stressProfile();
    case "soak":
      return soakProfile();
    case "writes":
      return writesProfile();
    case "webhooks":
      return webhooksProfile();
    case "all":
      return allProfile();
    case "smoke":
    default:
      return smokeProfile();
  }
}
