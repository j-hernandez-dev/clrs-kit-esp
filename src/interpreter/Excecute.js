import { spawn } from 'node:child_process';
import { Transpiler } from './Transpiler.js';

/**
 * @param {Transpiler} transpiler
 */
export function executeCodeInteractive(transpiler) {
  console.log('--- Starting interactive execution ---\n');

  // Lanzamos el proceso heredando los canales de entrada y salida estándar ('inherit')
  const proceso = spawn('node', [transpiler.JSFile], {
    stdio: 'inherit'
  });

  // Cuando el archivo temporal termine, volvemos a tomar el control aquí
  // @ts-ignore
  
  proceso.on('close', (/** @type {any} */ code) => {
    console.log(`\n--- The interactive execution ended (Exit code: ${code}) ---`);
    transpiler.deleteFile(transpiler.JSFile);
  });

  // @ts-ignore
  proceso.on('error', (error) => {
    console.error('Error al intentar lanzar el script:', error.message);
  });
}