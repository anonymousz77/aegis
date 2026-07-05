# Security Policy

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

To report a vulnerability, open a [GitHub Security Advisory](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) in this repository, or email the maintainers directly.

We will acknowledge your report within 48 hours and aim to resolve confirmed vulnerabilities within 14 days.

## Privacy guarantee

Aegis is designed with privacy as a hard invariant:

- No source code, snippet, or telemetry payload containing code content is ever sent over the network
- The only permitted outbound call is a one-time, pinned, checksum-verified model download
- All inference, indexing, and search runs entirely on-device
