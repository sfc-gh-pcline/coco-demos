export interface SemanticViewSummary {
  name: string
  database: string
  schema: string
  comment: string
  owner: string
  ownerRoleType: string
  createdOn: string
  extension: string[]
}

export interface DescribeRow {
  object_kind: string | null
  object_name: string | null
  parent_entity: string | null
  property: string
  property_value: string
}

export interface LogicalTable {
  name: string
  database: string
  schema: string
  baseTable: string
  primaryKey: string[]
  synonyms: string[]
  comment: string
}

export interface Dimension {
  name: string
  table: string
  expression: string
  dataType: string
  synonyms: string[]
  accessModifier: string
  comment: string
}

export interface Fact {
  name: string
  table: string
  expression: string
  dataType: string
  synonyms: string[]
  accessModifier: string
  comment: string
}

export interface Metric {
  name: string
  table: string
  expression: string
  dataType: string
  synonyms: string[]
  accessModifier: string
  comment: string
}

export interface Relationship {
  name: string
  table: string
  refTable: string
  foreignKey: string[]
  refKey: string[]
}

export interface VerifiedQuery {
  name: string
  question: string
  sql: string
  verifiedAt: string
  verifiedBy: string
  onboardingQuestion: boolean
}

export interface SemanticViewDetail {
  comment: string
  tables: LogicalTable[]
  dimensions: Dimension[]
  facts: Fact[]
  metrics: Metric[]
  relationships: Relationship[]
  verifiedQueries: VerifiedQuery[]
}
