#!/usr/bin/env bin/ts-node
import fs = require('fs');
import rimraf = require('rimraf');
import path = require('path');
import childProcess = require('child_process');

if (typeof process.argv[2] === 'string') {
  const pkgName = process.argv[2];
  const ciEnbaled = !!process.env.CI;
  const rootPath = process.cwd();
  const pkgPath = path.resolve('packages', pkgName);
  const distPath = path.join(pkgPath, 'dist');
  const modularFile = path.join(pkgPath, '.modular');
  const distModulesPath = path.join(pkgPath, 'm');
  const tmpPath = path.join(rootPath, '.tmp');
  const buildConfigInput = path.join(rootPath, 'build', 'rollup.config.ts');
  const buildConfigOutput = path.join(tmpPath, 'rollup.config.js');

  if ( ! fs.existsSync(pkgPath)) {
    throw new Error(`Package ${pkgName} does not exist`);
  }

  // Only compile rollup config if CI is disabled.
  // This will speed up the build time in CI environment
  if ( ! fs.existsSync(buildConfigOutput) || !ciEnbaled) {
    rimraf.sync(distPath);
    console.log(`🔧 Setting up build config`);

    const compileConfigFileProcess = childProcess.spawnSync(
      `
        tsc \
          ${buildConfigInput} \
          --outDir ${path.dirname(buildConfigOutput)} \
          --target ES6 \
          --moduleResolution node \
          --module ESNext
      `,
      {
        shell: true,
        stdio: 'inherit'
      }
    );

    if (compileConfigFileProcess.status !== 0)  {
      process.exit(compileConfigFileProcess.status);
    }
  }

  rimraf.sync(distPath);
  console.log(`📦 Building bundles for "${pkgName}":`);

  const buildProcess = childProcess.spawnSync(
    `
      rollup \
        -c ${buildConfigOutput} \
        --environment PACKAGE:${pkgPath}
    `,
    {
      shell: true,
      stdio: 'inherit'
    }
  );

  if (buildProcess.status !== 0)  {
    process.exit(buildProcess.status);
  }

  if (fs.existsSync(modularFile)) {
    rimraf.sync(distModulesPath);
    console.log(`🔔 .modular file found!`);
    console.log(`📦 Building modules for "${pkgName}":`);

    const buildModuleConfigFile = path.join(
      tmpPath,
      `tsconfig.${pkgName}.json`
    );

    const buildModuleConfigContent = {
      extends: path.join(pkgPath, 'tsconfig.json'),
      compilerOptions: {
        paths: {}
      }
    };

    fs.writeFileSync(
      buildModuleConfigFile,
      JSON.stringify(buildModuleConfigContent)
    );

    const buildModulesProcess = childProcess.spawnSync(
      `
        tsc \
          --module commonjs \
          --project ${buildModuleConfigFile} \
          --outDir ${distModulesPath}
      `,
      {
        shell: true,
        stdio: 'inherit'
      }
    );

    fs.unlinkSync(buildModuleConfigFile);

    if (buildModulesProcess.status !== 0)  {
      process.exit(buildModulesProcess.status);
    }
  }
} else {
  throw new Error('No package defined');
}
