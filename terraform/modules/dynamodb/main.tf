resource "aws_dynamodb_table" "conversations" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"

  # AWS Provider 6.x warns these are deprecated in favour of key_schema, but
  # key_schema blocks are not yet supported at the table top-level — accept the
  # warning and keep using the still-functional attributes.
  hash_key  = "PK"
  range_key = "SK"

  # ── Attribute definitions (all indexed attributes must be declared) ─────────
  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "updatedAt"
    type = "S"
  }

  # ── GSI: list sessions per user, sorted by last-updated ──────────────────
  # Query pattern: userId = "default-user" ORDER BY updatedAt DESC
  global_secondary_index {
    name            = "userId-updatedAt-index"
    projection_type = "ALL"

    key_schema {
      attribute_name = "userId"
      key_type       = "HASH"
    }

    key_schema {
      attribute_name = "updatedAt"
      key_type       = "RANGE"
    }
  }

  # Disabled for learning environment — enable for production
  point_in_time_recovery {
    enabled = false
  }

  # Allows terraform destroy without manual intervention
  deletion_protection_enabled = false

  tags = {
    Project = var.project_name
    Phase   = "2"
  }
}
