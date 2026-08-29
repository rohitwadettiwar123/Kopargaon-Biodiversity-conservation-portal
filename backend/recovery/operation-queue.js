const fs = require('fs');
const path = require('path');
const QUEUE_FILE = path.join(__dirname, '../recovery-data/pending-operations.json');

if (!fs.existsSync(path.dirname(QUEUE_FILE))) {
  fs.mkdirSync(path.dirname(QUEUE_FILE), { recursive: true });
}

function getQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  } catch (e) { return []; }
}

function saveQueue(queue) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

function addOperation(operation) {
  const queue = getQueue();
  queue.push(operation);
  saveQueue(queue);
}

function updateOperationStatus(operation_id, status) {
  const queue = getQueue();
  const op = queue.find(o => o.operation_id === operation_id);
  if (op) {
    op.status = status;
    saveQueue(queue);
  }
}

function getPendingOperations() {
  return getQueue().filter(o => o.status === 'PENDING');
}

module.exports = { addOperation, updateOperationStatus, getPendingOperations, getQueue, saveQueue };
