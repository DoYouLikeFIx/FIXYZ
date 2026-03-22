ui = true
disable_mlock = true

storage "raft" {
  path    = "/vault/file/raft"
  node_id = "vault-external-dev-1"
}

listener "tcp" {
  address         = "0.0.0.0:8200"
  cluster_address = "0.0.0.0:8201"
  tls_disable     = 1
}

api_addr = "http://vault-external-dev:8200"
cluster_addr = "http://vault-external-dev:8201"
