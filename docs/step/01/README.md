# Step 01 - Serverless Setup

Repository to learn and evolve by creating **TypeScript + Serverless applications** with **AWS CDK** and **GitHub Actions CI/CD**.

---

## Prerequisites

* [Node.js](https://nodejs.org/en/download)
* [Visual Studio Code](https://code.visualstudio.com/download)

---

## Setup

### 1. Check versions

```bash
node -v
npm -v
```

### 2. Clone repository

```bash
git clone https://github.com/clovisj/serverless-lab.git
cd serverless-lab
code .
```

### 3. Initialize npm

```bash
npm init -y
```

Update `package.json` values if necessary.

### 4. Install TypeScript

```bash
npm i -D typescript @types/node
npx tsc --init
```

Update `tsconfig.json` according to [Node Target Mapping](https://github.com/microsoft/TypeScript/wiki/Node-Target-Mapping).

---

## API Development

### 1. Create folder structure (`src/api/health/index-get/index.ts`)

Pattern: `{RESOURCE}/{CONTEXT}/{ROUTE}-{METHOD}/*`

### 2. Install Fastify

```bash
npm i -D fastify
```

### 3. Create test file (`test/api.ts`)

Implement Fastify configuration and link the API route.

### 4. Install transpiler

```bash
npm i -D tsx
```

### 5. Add dev script (`package.json`)

```json
"scripts": {
  "dev": "tsx watch test/api.ts"
}
```

### 6. Run in development mode

```bash
npm run dev
```

### 7. Configure VS Code debugger (`.vscode/launch.json`)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node-terminal",
      "name": "api",
      "request": "launch",
      "command": "node --import tsx test/api.ts",
      "cwd": "${workspaceRoot}"
    }
  ]
}
```

### 8. Test route

```bash
curl http://localhost:3001/health
```

---

## AWS CDK Configuration

### 1. Install CDK and libraries

```bash
npm i -g aws-cdk
npm i aws-cdk-lib
npm i -D dotenv
```

### 2. Create files

* `src/cdk/index.ts` – main app
* `src/cdk/lambda.ts` – Lambda stack (with VERSION and ALIAS)
* `cdk.json` – CDK configuration
* `.env` – environment variables

```ts
import "dotenv/config";
```

### 3. Add scripts (`package.json`)

```json
"scripts": {
  "build": "tsc --build",
  "cdk:bootstrap": "npm run build && cdk bootstrap",
  "cdk:synth": "npm run build && cdk synth",
  "cdk:deploy": "npm run build && cdk deploy --require-approval never",
  "cdk:destroy": "npm run build && cdk destroy"
}
```

### 4. CDK workflow

```bash
npm run build
npm run cdk:bootstrap --profile {AWS_PROFILE}
npm run cdk:synth "*"
npm run cdk:deploy "*" --profile {AWS_PROFILE}
```

Check results in the [AWS Console](https://console.aws.amazon.com/console) under CloudFormation and Lambda.

To remove resources:

```bash
npm run cdk:destroy "*" --profile {AWS_PROFILE}
```

---

## GitHub Actions Deployment

### 1. Create workflow (`.github/workflows/main.yml`)

### 2. Configure repository secrets

Set variables in [Repository Secrets](https://github.com/juca-dev/serverless-lab/settings/secrets/actions).

Create an User + `Access Key` by "Application running outside AWS"

### 3. Open Pull Request

Create a PR in [Pull Requests](https://github.com/juca-dev/serverless-lab/pulls).
The CI workflow will run automatically.

### 4. Deployment completed

Once the workflow passes, your serverless API will be deployed using **AWS CDK + GitHub Actions**.