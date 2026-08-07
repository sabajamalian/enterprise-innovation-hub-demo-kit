targetScope = 'subscription'

@minLength(1)
param environmentName string
param location string = deployment().location
param tenantId string = tenant().tenantId
param githubOrganization string
param githubRepository string

var suffix = uniqueString(subscription().id, environmentName)
var resourceGroupName = 'rg-${environmentName}-${suffix}'
var aksName = 'aks-${environmentName}-${suffix}'
var acrName = take(replace('acr${environmentName}${suffix}', '-', ''), 50)
var keyVaultName = take('kv-${environmentName}-${suffix}', 24)
var identityName = 'id-${environmentName}-deploy'

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: {
    workload: 'enterprise-innovation-hub'
    environment: environmentName
    managedBy: 'azd'
  }
}

module platform 'modules/platform.bicep' = {
  name: 'platform'
  scope: resourceGroup
  params: {
    location: location
    aksName: aksName
    acrName: acrName
    keyVaultName: keyVaultName
    identityName: identityName
    tenantId: tenantId
    githubSubject: 'repo:${githubOrganization}/${githubRepository}:ref:refs/heads/main'
  }
}

output AZURE_RESOURCE_GROUP string = resourceGroup.name
output AKS_CLUSTER_NAME string = platform.outputs.aksName
output ACR_NAME string = platform.outputs.acrName
output KEY_VAULT_NAME string = platform.outputs.keyVaultName
output APP_DEPLOY_CLIENT_ID string = platform.outputs.deployClientId
output APP_DEPLOY_IDENTITY_RESOURCE_ID string = platform.outputs.deployIdentityResourceId
