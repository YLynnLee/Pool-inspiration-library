# Troubleshooting

| Problem | Fix |
| --- | --- |
| **"One-time setup: start Pool"** keeps showing | The `pool://` link isn't registered yet. Double-click `Start Pool` once by hand. |
| Mac says `Start Pool` is from an unidentified developer | Right-click → **Open**, or **System Settings → Privacy & Security → Open Anyway**. |
| "Pool needs Node.js" | Install Node.js 20+ from [nodejs.org](https://nodejs.org/en/download), then start Pool again. |
| "Can't reach the library helper" | The helper stopped. Double-click `Start Pool`, or click **Connect AI** to start it in the background. |
| Adding a link says the browser can't write files | Use Chrome, Edge, Arc or Brave, not Safari or Firefox. |
| An agent app shows as not installed right after installing | Click **Check again**. If it still isn't found, quit and restart the helper. |
| Connecting a model fails the image check | That model can't see images. Pick a vision model. |
| A link shows **Last try failed** | The site couldn't be captured. Drain again later, or remove it from the inbox. |
| The helper's background log | `.helper/helper.log` in the Pool folder. |
| Screenshots fail and Chrome isn't installed | Run `npx playwright install chromium` once. |

Still stuck? [Open an issue](https://github.com/YLynnLee/Pool/issues).

---

Back to the [README](../README.md).
