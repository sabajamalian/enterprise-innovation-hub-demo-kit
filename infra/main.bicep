targetScope = 'subscription'

@minLength(1)
param environmentName string
param location string = deployment().location
param tenantId string = tenant().tenantId
param deployerPrincipalId string
@secure()
param githubAppId string
@secure()
param githubAppInstallationId string
@secure()
param githubAppPrivateKey string

var suffix = uniqueString(subscription().id, environmentName)
var resourceGroupName = 'rg-${environmentName}-${suffix}'
var aksName = 'aks-${environmentName}-${suffix}'
var acrName = take(replace('acr${environmentName}${suffix}', '-', ''), 50)
var keyVaultName = take('kv-${environmentName}-${suffix}', 24)
var identityName = 'id-${environmentName}-platform'

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
    deployerPrincipalId: deployerPrincipalId
    githubAppId: githubAppId
    githubAppInstallationId: githubAppInstallationId
    githubAppPrivateKey: githubAppPrivateKey
  }
}

output AZURE_RESOURCE_GROUP string = resourceGroup.name
output AKS_CLUSTER_NAME string = platform.outputs.aksName
output ACR_NAME string = platform.outputs.acrName
output KEY_VAULT_NAME string = platform.outputs.keyVaultName
output PLATFORM_CLIENT_ID string = platform.outputs.platformClientId
output PLATFORM_IDENTITY_RESOURCE_ID string = platform.outputs.platformIdentityResourceId
