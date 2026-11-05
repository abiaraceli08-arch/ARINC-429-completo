const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

async function getAvailablePort() {
    const probe = net.createServer();
    await new Promise((resolve, reject) => {
        probe.once('error', reject);
        probe.listen(0, '127.0.0.1', resolve);
    });
    const { port } = probe.address();
    await new Promise((resolve, reject) => probe.close((err) => err ? reject(err) : resolve()));
    return port;
}

test('el servidor local valida, transmite y persiste telemetría', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arinc429-test-'));
    const databasePath = path.join(tempDir, 'test.db');
    const port = await getAvailablePort();
    const child = spawn(process.execPath, [path.join(projectRoot, 'index.js')], {
        cwd: projectRoot,
        env: { ...process.env, PORT: String(port), ARINC_DB_PATH: databasePath },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });

    try {
        let startupTimeout;
        try {
            await Promise.race([
            new Promise((resolve, reject) => {
                child.stdout.on('data', (chunk) => {
                    if (chunk.toString().includes('corriendo localmente')) resolve();
                });
                child.once('error', reject);
                child.once('exit', (code) => reject(new Error(`El servidor terminó (${code}). ${output}`)));
            }),
                new Promise((_, reject) => {
                    startupTimeout = setTimeout(() => reject(new Error(`Tiempo de espera agotado. ${output}`)), 10000);
                })
            ]);
        } finally {
            clearTimeout(startupTimeout);
        }

        const baseUrl = `http://127.0.0.1:${port}`;
        const home = await fetch(baseUrl);
        assert.equal(home.status, 200);
        assert.match(await home.text(), /ARINC-429-completo/);

        const instrumentsResponse = await fetch(`${baseUrl}/api/instrumentos`);
        const instruments = await instrumentsResponse.json();
        assert.equal(instrumentsResponse.status, 200);
        assert.equal(instruments.length, 3);

        const validTransmission = await fetch(`${baseUrl}/api/transmitir`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ label: 0o203, valor: 3000 })
        });
        const transmitted = await validTransmission.json();
        assert.equal(validTransmission.status, 200);
        assert.equal(transmitted.binaryStr.length, 32);
        assert.equal([...transmitted.binaryStr].filter((bit) => bit === '1').length % 2, 1);

        const invalidTransmission = await fetch(`${baseUrl}/api/transmitir`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ label: 0o203, valor: 50001 })
        });
        assert.equal(invalidTransmission.status, 422);

        const historyResponse = await fetch(`${baseUrl}/api/historial`);
        const history = await historyResponse.json();
        assert.equal(historyResponse.status, 200);
        assert.equal(history.length, 1);
        assert.equal(history[0].valor, 3000);
        assert.ok(fs.existsSync(databasePath));
    } finally {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
        await new Promise((resolve) => {
            if (child.exitCode !== null || child.signalCode !== null) resolve();
            else child.once('exit', resolve);
        });
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
