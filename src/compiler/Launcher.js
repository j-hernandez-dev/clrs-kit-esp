import { spawn } from 'node:child_process';
import { Transpiler } from './Transpiler.js';
import { deleteFile } from "./utils/FileOperations.js";

export function launch(showFile, runningFile, deleFile, deleDir) {
  console.log(`\nCLRS Runtime\n────────────────\n▶ ${showFile}\n`);

  // Lanzamos el proceso heredando los canales de entrada y salida estándar ('inherit')
  const proceso = spawn('node', [runningFile], {
    stdio: 'inherit'
  });

  // Cuando el archivo temporal termine, volvemos a tomar el control aquí
  // @ts-ignore
  proceso.on('close', async (code) => {

    const state = code === 0 ? "Correct" : "Error";
    console.log(`\n────────────────\nStatus: ${state}\n`);
    await deleteFile(deleFile, deleDir);
  });

  // @ts-ignore
  proceso.on('error', (error) => {
    console.error('Error trying to run the code:', error.stack);
  });
}