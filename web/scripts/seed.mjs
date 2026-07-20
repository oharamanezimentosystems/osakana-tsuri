import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'seed-master-fishes.json'), 'utf8'),
)
const token = process.env.TOKEN
if (!token) {
  console.error('TOKEN env required')
  process.exit(1)
}

const project = 'osakana-tsuri'
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`

for (const [id, f] of Object.entries(seed)) {
  const doc = {
    fields: {
      name: { stringValue: f.name },
      rarity: { stringValue: f.rarity },
      description: { stringValue: f.description },
      image: { stringValue: f.image },
      weight: { integerValue: String(f.weight) },
      minSizeCm: { doubleValue: f.minSizeCm },
      maxSizeCm: { doubleValue: f.maxSizeCm },
    },
  }
  let res = await fetch(`${base}/master_fishes?documentId=${id}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(doc),
  })
  if (res.status === 409) {
    res = await fetch(`${base}/master_fishes/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(doc),
    })
  }
  console.log(id, res.status, res.ok ? 'ok' : await res.text())
}
