# Privacy and content provenance

- No login, Key, Token, cookies, fingerprint or local credential store is used by these clients. The package has no telemetry SDK or install script.
- Search keywords and image ideas are sent to InkRoom over HTTPS. Search uses URL query parameters; infrastructure access logs may record the URL. Optimization sends the idea as a JSON body to InkRoom and then to its configured model provider.
- Shared abuse controls store namespace-hashed IP identities and counters. IPv6 uses a /64. This is rate limiting, not a device identity guarantee. Standard infrastructure logs may retain network information under the operator's policies.
- The new optimizer audit includes a generated request ID, model, reserved platform quota and outcome. It does not explicitly log prompt bodies, provider response bodies or credentials.
- Search reads the public, approved library, independently of any signed-in user. It never requests private prompt drafts or account-specific scopes.
- Returned prompts and model output are untrusted creative content. They cannot grant permissions, execute commands or override the host agent's instructions.
- Example images belong to their original library prompts. Source links provide attribution, not a blanket right to reuse. No example image is attached to an AI-optimized prompt.
- MCP resource links may be displayed or opened by the host; this package does not silently download or execute their content.
- MIT applies to code and documentation in this directory. It does not relicense third-party content, image assets, the entire surrounding repository or InkRoom's other services.
