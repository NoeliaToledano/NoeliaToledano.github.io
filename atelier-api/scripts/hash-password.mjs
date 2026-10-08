// Genera el valor de la contraseña de un perfil para Vercel (no se despliega: no está en api/).
// Uso:  node atelier-api/scripts/hash-password.mjs eva
// Pide la contraseña sin mostrarla y escribe la variable de entorno que hay que crear en Vercel.
import crypto from "node:crypto";
import readline from "node:readline";

const PROFILES = { noelia: "NOELIA", "ana-maria": "ANA_MARIA", irene: "IRENE", eva: "EVA", virginia: "VIRGINIA" };
const profile = process.argv[2];
if (!PROFILES[profile]) {
  console.error("Indica el perfil: " + Object.keys(PROFILES).join(", ") + "\nEjemplo: node atelier-api/scripts/hash-password.mjs eva");
  process.exit(1);
}

function ask(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = text => { if (text.startsWith(question)) process.stdout.write(text); };  // no muestra lo que se escribe
    rl.question(question, answer => { rl.close(); process.stdout.write("\n"); resolve(answer); });
  });
}

const password = process.stdin.isTTY ? await ask("Contraseña para " + profile + ": ") : (await new Promise(r => { let d = ""; process.stdin.on("data", c => d += c).on("end", () => r(d)); })).replace(/\r?\n$/, "");
if (password.length < 6) { console.error("La contraseña debe tener al menos 6 caracteres."); process.exit(1); }

// Mismo formato que verifyPasswordRecord en _lib/auth.js: scrypt$N$r$p$sal$hash
const N = 16384, r = 8, p = 1, salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 32, { N, r, p });
const record = ["scrypt", N, r, p, salt.toString("base64url"), hash.toString("base64url")].join("$");

console.log("\nCrea esta variable en Vercel (proyecto del backend › Settings › Environment Variables):\n");
console.log("  Nombre: ATELIER_PASSWORD_" + PROFILES[profile]);
console.log("  Valor:  " + record + "\n");
console.log("Después, vuelve a desplegar el backend.");
