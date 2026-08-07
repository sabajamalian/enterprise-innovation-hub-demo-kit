param location string
param aksName string
param acrName string
param keyVaultName string
param identityName string
param tenantId string
param githubSubject string

var aksSubnetName = 'aks'
var vnetName = 'vnet-${aksName}'

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${aksName}'
  location: location
  properties: {
    retentionInDays: 30
    features: { enableLogAccessUsingOnlyResourcePermissions: true }
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2024-01-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.42.0.0/16'] }
    subnets: [
      {
        name: aksSubnetName
        properties: { addressPrefix: '10.42.0.0/20' }
      }
    ]
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: acrName
  location: location
  sku: { name: 'Standard' }
  properties: {
    adminUserEnabled: false
    anonymousPullEnabled: false
    publicNetworkAccess: 'Enabled'
    policies: {
      quarantinePolicy: { status: 'disabled' }
      retentionPolicy: { days: 7, status: 'enabled' }
      trustPolicy: { type: 'Notary', status: 'disabled' }
    }
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: tenantId
    enableRbacAuthorization: true
    enablePurgeProtection: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
    sku: { family: 'A', name: 'standard' }
  }
}

resource deployIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
}

resource githubCredential 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: deployIdentity
  name: 'github-main'
  properties: {
    audiences: ['api://AzureADTokenExchange']
    issuer: 'https://token.actions.githubusercontent.com'
    subject: githubSubject
  }
}

resource aks 'Microsoft.ContainerService/managedClusters@2024-02-01' = {
  name: aksName
  location: location
  identity: { type: 'SystemAssigned' }
  sku: { name: 'Base', tier: 'Standard' }
  properties: {
    dnsPrefix: aksName
    enableRBAC: true
    disableLocalAccounts: true
    apiServerAccessProfile: { enablePrivateCluster: false }
    aadProfile: {
      managed: true
      enableAzureRBAC: true
      tenantID: tenantId
    }

    oidcIssuerProfile: { enabled: true }
    securityProfile: {
      workloadIdentity: { enabled: true }
      defender: {
        logAnalyticsWorkspaceResourceId: logs.id
        securityMonitoring: { enabled: true }
      }
    }
    addonProfiles: {
      azureKeyvaultSecretsProvider: {
        enabled: true
        config: { enableSecretRotation: 'true' }
      }
      omsagent: {
        enabled: true
        config: { logAnalyticsWorkspaceResourceID: logs.id }
      }
      azurepolicy: { enabled: true }
    }
    agentPoolProfiles: [
      {
        name: 'system'
        count: 3
        vmSize: 'Standard_D4ds_v5'
        osType: 'Linux'
        mode: 'System'
        type: 'VirtualMachineScaleSets'
        vnetSubnetID: vnet.properties.subnets[0].id
        enableAutoScaling: true
        minCount: 3
        maxCount: 6
        maxPods: 50
      }
    ]
    networkProfile: {
      networkPlugin: 'azure'
      networkPluginMode: 'overlay'
      networkPolicy: 'cilium'
      networkDataplane: 'cilium'
      loadBalancerSku: 'standard'
      serviceCidr: '10.43.0.0/16'
      dnsServiceIP: '10.43.0.10'
    }
  }
}

resource hubCredential 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: deployIdentity
  name: 'hub-service-account'
  properties: {
    audiences: ['api://AzureADTokenExchange']
    issuer: aks.properties.oidcIssuerProfile.issuerURL
    subject: 'system:serviceaccount:innovation-hub-system:hub'
  }
}

var acrPullRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, aks.id, acrPullRole)
  scope: acr
  properties: {
    principalId: aks.properties.identityProfile.kubeletidentity.objectId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPullRole
  }
}

var acrPushRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '8311e382-0749-4cb8-b61a-304f252e45ec')
resource acrPush 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, deployIdentity.id, acrPushRole)
  scope: acr
  properties: {
    principalId: deployIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPushRole
  }
}

var clusterUserRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4abbcc35-e782-43d8-92c5-2d3f1bd2253f')
resource clusterUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aks.id, deployIdentity.id, clusterUserRole)
  scope: aks
  properties: {
    principalId: deployIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: clusterUserRole
  }
}

var aksRbacWriterRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'a7ffa36f-339b-4b5c-8bdf-e2c188b2c0eb')
resource aksWriter 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aks.id, deployIdentity.id, aksRbacWriterRole)
  scope: aks
  properties: {
    principalId: deployIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: aksRbacWriterRole
  }
}

var managedIdentityContributorRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'e40ec5ca-96e0-45a2-b4ff-59039f2c2b59')
resource identityContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(deployIdentity.id, managedIdentityContributorRole)
  scope: deployIdentity
  properties: {
    principalId: deployIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: managedIdentityContributorRole
  }
}

output aksName string = aks.name
output acrName string = acr.name
output keyVaultName string = keyVault.name
output deployClientId string = deployIdentity.properties.clientId
output deployIdentityResourceId string = deployIdentity.id
