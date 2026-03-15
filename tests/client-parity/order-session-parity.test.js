const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const readJson = (relativePath) =>
  JSON.parse(readFileSync(resolve(__dirname, '..', '..', relativePath), 'utf8'));

const sortBy = (items, selector) =>
  [...items].sort((left, right) => selector(left).localeCompare(selector(right)));

const normalizeOrderSessionContract = (contract) => ({
  authorizationScenarios: sortBy(
    contract.authorizationScenarios ?? [],
    (scenario) => scenario.scenarioKey,
  ).map((scenario) => ({
    scenarioKey: scenario.scenarioKey,
    status: scenario.status,
    challengeRequired: scenario.challengeRequired,
    authorizationReason: scenario.authorizationReason,
    failureReason: scenario.failureReason ?? null,
    clientStep: scenario.clientStep,
    nextAction: scenario.nextAction,
    title: scenario.title,
    body: scenario.body,
  })),
  processingStates: sortBy(contract.processingStates ?? [], (scenario) => scenario.name).map(
    (scenario) => ({
      name: scenario.name,
      status: scenario.status,
      title: scenario.title,
      body: scenario.body,
    }),
  ),
  finalResults: sortBy(contract.finalResults ?? [], (scenario) => scenario.name).map((scenario) => ({
    name: scenario.name,
    status: scenario.status,
    executionResult: scenario.executionResult ?? null,
    title: scenario.title,
    body: scenario.body,
    externalOrderId: scenario.externalOrderId ?? null,
    executionResultLabel: scenario.executionResultLabel ?? null,
    executedQty: scenario.executedQty ?? null,
    executedQtyLabel: scenario.executedQtyLabel ?? null,
    leavesQty: scenario.leavesQty ?? null,
    leavesQtyLabel: scenario.leavesQtyLabel ?? null,
    executedPrice: scenario.executedPrice ?? null,
    executedPriceLabel: scenario.executedPriceLabel ?? null,
    failureReason: scenario.failureReason ?? null,
    failureReasonLabel: scenario.failureReasonLabel ?? null,
    canceledAt: scenario.canceledAt ?? null,
    canceledAtLabel: scenario.canceledAtLabel ?? null,
  })),
});

const normalizeExternalOrderErrorContract = (contract) => ({
  supportReferenceLabel: contract.supportReferenceLabel,
  cases: sortBy(
    contract.cases ?? [],
    (contractCase) =>
      `${(contractCase.codes ?? []).slice().sort().join('|')}::${contractCase.operatorCode ?? ''}`,
  ).map((contractCase) => ({
    codes: [...(contractCase.codes ?? [])].sort(),
    operatorCode: contractCase.operatorCode ?? null,
    retryAfterSeconds: contractCase.retryAfterSeconds ?? null,
    semantic: contractCase.semantic,
    recoveryAction: contractCase.recoveryAction,
    severity: contractCase.severity,
    title: contractCase.title,
    message: contractCase.message,
    nextStep: contractCase.nextStep,
  })),
  unknownFallback: {
    semantic: contract.unknownFallback.semantic,
    recoveryAction: contract.unknownFallback.recoveryAction,
    severity: contract.unknownFallback.severity,
    title: contract.unknownFallback.title,
    message: contract.unknownFallback.message,
    nextStep: contract.unknownFallback.nextStep,
  },
});

test('FE and MOB keep the authorization scenario matrix semantically aligned', () => {
  const canonicalOrderSessionContract = normalizeOrderSessionContract(
    readJson('docs/contracts/order-session-ux.json'),
  );
  const feContract = normalizeOrderSessionContract(
    readJson('FE/tests/order-session-contract-cases.json'),
  );
  const mobContract = normalizeOrderSessionContract(
    readJson('MOB/tests/order-session-contract-cases.json'),
  );

  assert.deepEqual(mobContract.authorizationScenarios, feContract.authorizationScenarios);
  assert.deepEqual(feContract.authorizationScenarios, canonicalOrderSessionContract.authorizationScenarios);
});

test('FE and MOB keep order-session guidance fixtures semantically aligned', () => {
  const canonicalOrderSessionContract = normalizeOrderSessionContract(
    readJson('docs/contracts/order-session-ux.json'),
  );
  const feContract = normalizeOrderSessionContract(
    readJson('FE/tests/order-session-contract-cases.json'),
  );
  const mobContract = normalizeOrderSessionContract(
    readJson('MOB/tests/order-session-contract-cases.json'),
  );

  assert.deepEqual(mobContract.processingStates, feContract.processingStates);
  assert.deepEqual(mobContract.finalResults, feContract.finalResults);
  assert.deepEqual(feContract.processingStates, canonicalOrderSessionContract.processingStates);
  assert.deepEqual(feContract.finalResults, canonicalOrderSessionContract.finalResults);
});

test('FE and MOB keep backend error semantics aligned for the same external outcomes', () => {
  const canonicalErrorContract = normalizeExternalOrderErrorContract(
    readJson('docs/contracts/external-order-error-ux.json'),
  );
  const feErrorContract = normalizeExternalOrderErrorContract(
    readJson('FE/docs/contracts/external-order-error-ux.json'),
  );
  const mobErrorContract = normalizeExternalOrderErrorContract(
    readJson('MOB/docs/contracts/external-order-error-ux.json'),
  );

  assert.deepEqual(feErrorContract, canonicalErrorContract);
  assert.deepEqual(mobErrorContract, feErrorContract);
});
