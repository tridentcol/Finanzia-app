import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

// ============================================================
// Enums
// ============================================================

export const accountType = pgEnum('account_type', [
  'checking',
  'savings',
  'credit_card',
  'cash',
  'investment',
  'crypto',
  'other',
])

export const transactionKind = pgEnum('transaction_kind', ['income', 'expense', 'transfer'])

export const categoryKind = pgEnum('category_kind', ['income', 'expense', 'transfer'])

export const budgetPeriod = pgEnum('budget_period', ['monthly', 'weekly', 'yearly'])

export const goalStatus = pgEnum('goal_status', ['active', 'paused', 'completed', 'abandoned'])

export const recurringFrequency = pgEnum('recurring_frequency', [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
])

export const insightKind = pgEnum('insight_kind', [
  'anomaly',
  'trend',
  'forecast',
  'recommendation',
  'achievement',
])

export const insightSeverity = pgEnum('insight_severity', ['info', 'notice', 'warning'])

export const insightStatus = pgEnum('insight_status', ['unread', 'read', 'dismissed', 'acted'])

export const messageRole = pgEnum('message_role', ['user', 'assistant', 'tool'])

export const alertKind = pgEnum('alert_kind', [
  'unusual_spend',
  'budget_exceeded',
  'recurring_due',
  'low_balance',
  'goal_at_risk',
])

export const importStatus = pgEnum('import_status', [
  'pending',
  'processing',
  'completed',
  'failed',
])

export const debtType = pgEnum('debt_type', [
  'loan_personal',
  'mortgage',
  'auto_loan',
  'student_loan',
  'family_loan',
  'other',
])

export const debtStatus = pgEnum('debt_status', ['active', 'paid', 'defaulted'])

export const integrationProvider = pgEnum('integration_provider', [
  'anthropic',
  'openai',
])

export const integrationStatus = pgEnum('integration_status', [
  'active',
  'invalid',
  'disabled',
])

// ============================================================
// users
// ============================================================

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clerkId: text('clerk_id').notNull().unique(),
    email: text('email').notNull(),
    name: text('name'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('idx_users_clerk_id').on(t.clerkId)],
)

// ============================================================
// profiles
// ============================================================

export const profiles = pgTable('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  baseCurrency: text('base_currency').notNull().default('COP'),
  secondaryCurrencies: text('secondary_currencies')
    .array()
    .notNull()
    .default(sql`ARRAY['USD']::text[]`),
  locale: text('locale').notNull().default('es-CO'),
  timezone: text('timezone').notNull().default('America/Bogota'),
  aiProfile: jsonb('ai_profile'),
  aiEnabled: boolean('ai_enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ============================================================
// accounts
// ============================================================

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: accountType('type').notNull(),
    currency: text('currency').notNull(),
    initialBalance: numeric('initial_balance', { precision: 15, scale: 2 })
      .notNull()
      .default('0'),
    creditLimit: numeric('credit_limit', { precision: 15, scale: 2 }),
    statementDay: smallint('statement_day'),
    paymentDay: smallint('payment_day'),
    // Identidad visual de la tarjeta (todos opcionales, decorativos).
    // bankSlug + cardProductSlug indexan el catálogo en src/lib/cards/catalog.ts
    // para resolver la imagen y el wordmark del banco. cardBrand identifica la
    // red (visa/mastercard/amex). cardLastFour y cardHolderName son metadata
    // del usuario que se renderiza junto a (no sobre) la imagen del banco.
    bankSlug: text('bank_slug'),
    cardProductSlug: text('card_product_slug'),
    cardBrand: text('card_brand'),
    cardLastFour: text('card_last_four'),
    cardHolderName: text('card_holder_name'),
    color: text('color'),
    icon: text('icon'),
    archived: boolean('archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_accounts_user').on(t.userId)],
)

// ============================================================
// categories
// ============================================================

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // userId null = system seed category (visible to all users)
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    kind: categoryKind('kind').notNull(),
    icon: text('icon'),
    color: text('color'),
    sortOrder: integer('sort_order').notNull().default(0),
    archived: boolean('archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_categories_user').on(t.userId)],
)

// ============================================================
// import_batches  (declared before transactions for FK ordering)
// ============================================================

export const importBatches = pgTable('import_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  totalRows: integer('total_rows').notNull().default(0),
  importedRows: integer('imported_rows').notNull().default(0),
  status: importStatus('status').notNull().default('pending'),
  mapping: jsonb('mapping'),
  errors: jsonb('errors'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})

// ============================================================
// recurring_rules
// ============================================================

export const recurringRules = pgTable('recurring_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  kind: transactionKind('kind').notNull(),
  frequency: recurringFrequency('frequency').notNull(),
  dayOfMonth: smallint('day_of_month'),
  dayOfWeek: smallint('day_of_week'),
  nextRun: date('next_run'),
  lastRun: date('last_run'),
  active: boolean('active').notNull().default(true),
  autoCreate: boolean('auto_create').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ============================================================
// transactions
// ============================================================

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    date: date('date').notNull(),
    amountOriginal: numeric('amount_original', { precision: 15, scale: 2 }).notNull(),
    currency: text('currency').notNull(),
    amountBase: numeric('amount_base', { precision: 15, scale: 2 }).notNull(),
    exchangeRate: numeric('exchange_rate', { precision: 15, scale: 6 }),
    description: text('description').notNull(),
    merchant: text('merchant'),
    kind: transactionKind('kind').notNull(),
    transferAccountId: uuid('transfer_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    /**
     * Para transferencias cross-currency (dos asientos espejo, uno en cada
     * cuenta y moneda), ambas filas comparten este UUID. Para transfers
     * same-currency (fila única con `transfer_account_id` no nulo) queda nulo.
     */
    transferGroupId: uuid('transfer_group_id'),
    notes: text('notes'),
    tags: text('tags').array(),
    recurringRuleId: uuid('recurring_rule_id').references(() => recurringRules.id, {
      onDelete: 'set null',
    }),
    importBatchId: uuid('import_batch_id').references(() => importBatches.id, {
      onDelete: 'set null',
    }),
    aiCategorized: boolean('ai_categorized').notNull().default(false),
    aiConfidence: numeric('ai_confidence', { precision: 3, scale: 2 }),
    userCorrected: boolean('user_corrected').notNull().default(false),
    embedding: vector('embedding', { dimensions: 1536 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_transactions_user_date').on(t.userId, t.date.desc()),
    index('idx_transactions_user_category').on(t.userId, t.categoryId),
    index('idx_transactions_account').on(t.accountId),
    index('idx_transactions_transfer_group').on(t.transferGroupId),
    index('idx_transactions_embedding').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ],
)

// ============================================================
// budgets
// ============================================================

export const budgets = pgTable(
  'budgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    period: budgetPeriod('period').notNull().default('monthly'),
    startDate: date('start_date').notNull(),
    rollover: boolean('rollover').notNull().default(false),
    archived: boolean('archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_budgets_user_category').on(t.userId, t.categoryId)],
)

// ============================================================
// goals
// ============================================================

export const goals = pgTable(
  'goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    targetAmount: numeric('target_amount', { precision: 15, scale: 2 }).notNull(),
    currency: text('currency').notNull(),
    targetDate: date('target_date'),
    linkedAccountId: uuid('linked_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    currentAmount: numeric('current_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    status: goalStatus('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_goals_user').on(t.userId)],
)

// ============================================================
// insights
// ============================================================

export const insights = pgTable(
  'insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: insightKind('kind').notNull(),
    severity: insightSeverity('severity').notNull().default('info'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    data: jsonb('data'),
    action: jsonb('action'),
    status: insightStatus('status').notNull().default('unread'),
    periodStart: date('period_start'),
    periodEnd: date('period_end'),
    generatedBy: text('generated_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    actedAt: timestamp('acted_at', { withTimezone: true }),
  },
  (t) => [index('idx_insights_user_status').on(t.userId, t.status, t.createdAt.desc())],
)

// ============================================================
// conversations  (copiloto)
// ============================================================

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_conversations_user').on(t.userId)],
)

// ============================================================
// messages
// ============================================================

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: messageRole('role').notNull(),
    content: jsonb('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_messages_conversation').on(t.conversationId, t.createdAt)],
)

// ============================================================
// alerts
// ============================================================

export const alerts = pgTable(
  'alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: alertKind('kind').notNull(),
    refId: uuid('ref_id'),
    message: text('message').notNull(),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_alerts_user_read').on(t.userId, t.read)],
)

// ============================================================
// debts
// ============================================================

export const debts = pgTable(
  'debts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    lender: text('lender'),
    type: debtType('type').notNull(),
    /** Monto original asumido. */
    principal: numeric('principal', { precision: 15, scale: 2 }).notNull(),
    /** Saldo pendiente actual. */
    currentBalance: numeric('current_balance', { precision: 15, scale: 2 }).notNull(),
    currency: text('currency').notNull(),
    /** Tasa anual nominal (%) — ej. 18.50 representa 18.5% anual. */
    interestRate: numeric('interest_rate', { precision: 7, scale: 4 }),
    /** Cuota fija mensual (si aplica). */
    installmentAmount: numeric('installment_amount', { precision: 15, scale: 2 }),
    /** Plazo total en meses. */
    termMonths: integer('term_months'),
    /** Fecha en que se asumió la deuda. */
    originDate: date('origin_date'),
    /** Próximo pago programado. */
    nextPaymentDate: date('next_payment_date'),
    /** Día del mes en que vence (1-31). */
    paymentDay: smallint('payment_day'),
    /** Cuenta vinculada para pagos (opcional). */
    linkedAccountId: uuid('linked_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    status: debtStatus('status').notNull().default('active'),
    notes: text('notes'),
    archived: boolean('archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_debts_user').on(t.userId),
    index('idx_debts_user_status').on(t.userId, t.status),
  ],
)

// ============================================================
// exchange_rates  (cache, composite PK)
// ============================================================

// ============================================================
// user_integrations  (vault-backed API keys del usuario)
// ============================================================

export const userIntegrations = pgTable(
  'user_integrations',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: integrationProvider('provider').notNull(),
    /** UUID que apunta a vault.secrets.id donde vive la API key cifrada. */
    secretId: uuid('secret_id').notNull(),
    scopes: text('scopes')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    status: integrationStatus('status').notNull().default('active'),
    lastValidatedAt: timestamp('last_validated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.provider] }),
    index('idx_user_integrations_user').on(t.userId),
  ],
)

export const exchangeRates = pgTable(
  'exchange_rates',
  {
    date: date('date').notNull(),
    fromCurrency: text('from_currency').notNull(),
    toCurrency: text('to_currency').notNull(),
    rate: numeric('rate', { precision: 15, scale: 6 }).notNull(),
    source: text('source').notNull().default('exchangerate.host'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.date, t.fromCurrency, t.toCurrency] })],
)

// ============================================================
// Relations
// ============================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  accounts: many(accounts),
  categories: many(categories),
  transactions: many(transactions),
  budgets: many(budgets),
  goals: many(goals),
  recurringRules: many(recurringRules),
  insights: many(insights),
  conversations: many(conversations),
  alerts: many(alerts),
  importBatches: many(importBatches),
  debts: many(debts),
}))

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
}))

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  transactions: many(transactions),
  debts: many(debts),
}))

export const debtsRelations = relations(debts, ({ one }) => ({
  user: one(users, { fields: [debts.userId], references: [users.id] }),
  linkedAccount: one(accounts, {
    fields: [debts.linkedAccountId],
    references: [accounts.id],
  }),
}))

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'category_parent',
  }),
  children: many(categories, { relationName: 'category_parent' }),
  transactions: many(transactions),
  budgets: many(budgets),
}))

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  recurringRule: one(recurringRules, {
    fields: [transactions.recurringRuleId],
    references: [recurringRules.id],
  }),
  importBatch: one(importBatches, {
    fields: [transactions.importBatchId],
    references: [importBatches.id],
  }),
}))

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(users, { fields: [budgets.userId], references: [users.id] }),
  category: one(categories, { fields: [budgets.categoryId], references: [categories.id] }),
}))

export const goalsRelations = relations(goals, ({ one }) => ({
  user: one(users, { fields: [goals.userId], references: [users.id] }),
  linkedAccount: one(accounts, {
    fields: [goals.linkedAccountId],
    references: [accounts.id],
  }),
}))

export const recurringRulesRelations = relations(recurringRules, ({ one }) => ({
  user: one(users, { fields: [recurringRules.userId], references: [users.id] }),
  account: one(accounts, { fields: [recurringRules.accountId], references: [accounts.id] }),
  category: one(categories, { fields: [recurringRules.categoryId], references: [categories.id] }),
}))

export const insightsRelations = relations(insights, ({ one }) => ({
  user: one(users, { fields: [insights.userId], references: [users.id] }),
}))

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
  messages: many(messages),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}))

export const alertsRelations = relations(alerts, ({ one }) => ({
  user: one(users, { fields: [alerts.userId], references: [users.id] }),
}))

export const importBatchesRelations = relations(importBatches, ({ one, many }) => ({
  user: one(users, { fields: [importBatches.userId], references: [users.id] }),
  account: one(accounts, { fields: [importBatches.accountId], references: [accounts.id] }),
  transactions: many(transactions),
}))

// ============================================================
// Type helpers
// ============================================================

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert
export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert
export type Transaction = typeof transactions.$inferSelect
export type NewTransaction = typeof transactions.$inferInsert
export type Budget = typeof budgets.$inferSelect
export type NewBudget = typeof budgets.$inferInsert
export type Goal = typeof goals.$inferSelect
export type NewGoal = typeof goals.$inferInsert
export type RecurringRule = typeof recurringRules.$inferSelect
export type NewRecurringRule = typeof recurringRules.$inferInsert
export type Debt = typeof debts.$inferSelect
export type NewDebt = typeof debts.$inferInsert
export type Insight = typeof insights.$inferSelect
export type NewInsight = typeof insights.$inferInsert
export type Conversation = typeof conversations.$inferSelect
export type NewConversation = typeof conversations.$inferInsert
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
export type Alert = typeof alerts.$inferSelect
export type NewAlert = typeof alerts.$inferInsert
export type ImportBatch = typeof importBatches.$inferSelect
export type NewImportBatch = typeof importBatches.$inferInsert
export type ExchangeRate = typeof exchangeRates.$inferSelect
export type NewExchangeRate = typeof exchangeRates.$inferInsert
export type UserIntegration = typeof userIntegrations.$inferSelect
export type NewUserIntegration = typeof userIntegrations.$inferInsert
