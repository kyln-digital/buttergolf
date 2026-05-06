import { buildOptions, getProfileName } from "./config/profiles.js";
import { prepareFixtures } from "./lib/fixtures.js";
import { runPublicBrowse } from "./scenarios/public.js";
import { runProtectedReads, runUnauthenticatedChecks } from "./scenarios/protected.js";
import { runWriteFlows } from "./scenarios/writes.js";
import { runWebhookResilience } from "./scenarios/webhooks.js";

export const options = buildOptions();

export function setup() {
  return prepareFixtures();
}

export function publicBrowse(data) {
  runPublicBrowse(data);
}

export function protectedReads(data) {
  runProtectedReads(data);
}

export function unauthenticatedChecks(data) {
  runUnauthenticatedChecks(data);
}

export function writeFlows(data) {
  runWriteFlows(data);
}

export function webhookResilience(data) {
  runWebhookResilience(data);
}

function metricValue(metric, key) {
  if (!metric || !metric.values) return "n/a";
  const value = metric.values[key];
  if (value === undefined || value === null) return "n/a";
  return typeof value === "number" ? value.toFixed(2) : String(value);
}

function renderMarkdownSummary(data) {
  const profileName = getProfileName();
  const metrics = data.metrics || {};
  const durationP95 = metricValue(metrics.http_req_duration, "p(95)");
  const durationP99 = metricValue(metrics.http_req_duration, "p(99)");
  const failureRate = metricValue(metrics.http_req_failed, "rate");
  const checkRate = metricValue(metrics.checks, "rate");
  const requestCount = metricValue(metrics.http_reqs, "count");

  return [
    `# ButterGolf k6 ${profileName} summary`,
    "",
    `- Base URL: ${__ENV.K6_BASE_URL || "http://localhost:3000"}`,
    `- Stage: ${__ENV.K6_STAGE || profileName}`,
    `- Requests: ${requestCount}`,
    `- Check pass rate: ${checkRate}`,
    `- HTTP failure rate: ${failureRate}`,
    `- HTTP p95: ${durationP95} ms`,
    `- HTTP p99: ${durationP99} ms`,
    "",
    "Review the JSON summary for route-tag detail and threshold diagnostics.",
    "",
  ].join("\n");
}

function renderStdoutSummary(data) {
  const metrics = data.metrics || {};
  return [
    "\nButterGolf k6 summary",
    `Profile: ${getProfileName()}`,
    `Requests: ${metricValue(metrics.http_reqs, "count")}`,
    `Checks: ${metricValue(metrics.checks, "rate")}`,
    `Failures: ${metricValue(metrics.http_req_failed, "rate")}`,
    `p95: ${metricValue(metrics.http_req_duration, "p(95)")} ms`,
    `p99: ${metricValue(metrics.http_req_duration, "p(99)")} ms`,
    "",
  ].join("\n");
}

export function handleSummary(data) {
  const profileName = getProfileName();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputStem = `scripts/k6/results/${profileName}-${timestamp}`;

  return {
    stdout: renderStdoutSummary(data),
    [`${outputStem}.json`]: JSON.stringify(data, null, 2),
    [`${outputStem}.md`]: renderMarkdownSummary(data),
  };
}
