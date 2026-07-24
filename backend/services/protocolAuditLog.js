// Compat: a auditoria foi generalizada em automationAuditLog.js (coluna
// resource_type). Protocolos continuam gravando com resource_type='protocol'
// (o padrão), então este módulo apenas reexporta a implementação genérica.

module.exports = require('./automationAuditLog');
