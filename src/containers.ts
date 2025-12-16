import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

function buildKubectlEnvironment(kubeconfig?: string): NodeJS.ProcessEnv {
  if (!kubeconfig) {
    return process.env;
  }
  return {
    ...process.env,
    // eslint-disable-next-line @typescript-eslint/naming-convention -- environment variable name
    KUBECONFIG: kubeconfig,
  };
}

export type ContainerConfig = {
  image: string;
  environment: Record<string, string>;
  volumes: string[];
  ports: Record<string, string>;
  secrets: Record<string, string>;
};

export type KubernetesConfig = {
  namespace: string;
  serviceAccount: string;
  secrets: Record<string, Record<string, string>>;
  configMaps: Record<string, Record<string, string>>;
};

export class DockerIntegration {
  async createContainer(name: string, config: ContainerConfig): Promise<string> {
    const environmentVariables = Object.entries(config.environment)
      .map(([key, value]) => `-e ${key}="${value}"`)
      .join(' ');

    const volumes = config.volumes.map((v) => `-v ${v}`).join(' ');
    const ports = Object.entries(config.ports)
      .map(([host, container]) => `-p ${host}:${container}`)
      .join(' ');

    const secrets = Object.entries(config.secrets)
      .map(([key, value]) => `-e ${key}="${value}"`)
      .join(' ');

    const command = `docker run -d --name ${name} ${environmentVariables} ${volumes} ${ports} ${secrets} ${config.image}`;

    try {
      const { stdout } = await execAsync(command);
      return stdout.trim();
    } catch (error) {
      throw new Error(`Failed to create Docker container: ${error}`);
    }
  }

  async injectSecrets(containerId: string, secrets: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(secrets)) {
      const command = `docker exec ${containerId} sh -c "echo '${value}' > /run/secrets/${key}"`;
      try {
        await execAsync(command);
      } catch (error) {
        console.warn(`Failed to inject secret ${key}: ${error}`);
      }
    }
  }

  async getContainerLogs(containerId: string, tail = 100): Promise<string> {
    try {
      const { stdout } = await execAsync(`docker logs --tail ${tail} ${containerId}`);
      return stdout;
    } catch (error) {
      throw new Error(`Failed to get container logs: ${error}`);
    }
  }

  async stopContainer(containerId: string): Promise<void> {
    try {
      await execAsync(`docker stop ${containerId}`);
    } catch (error) {
      throw new Error(`Failed to stop container: ${error}`);
    }
  }

  async removeContainer(containerId: string): Promise<void> {
    try {
      await execAsync(`docker rm ${containerId}`);
    } catch (error) {
      throw new Error(`Failed to remove container: ${error}`);
    }
  }

  async listContainers(): Promise<Array<{ id: string; name: string; status: string }>> {
    try {
      const { stdout } = await execAsync('docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}"');
      return stdout
        .trim()
        .split('\n')
        .filter((line) => line)
        .map((line) => {
          const parts = line.split('|');
          return {
            id: parts[0] ?? '',
            name: parts[1] ?? '',
            status: parts[2] ?? '',
          };
        });
    } catch (error) {
      throw new Error(`Failed to list containers: ${error}`);
    }
  }
}

export class K8sIntegration {
  constructor(private readonly kubeconfig?: string) {}

  async createSecret(name: string, namespace: string, data: Record<string, string>): Promise<void> {
    const secretData = Object.entries(data)
      .map(([key, value]) => `${key}=${Buffer.from(value).toString('base64')}`)
      .join(',');

    const command = `kubectl create secret generic ${name} --from-literal=${secretData} --namespace=${namespace}`;

    try {
      await execAsync(command, {
        env: buildKubectlEnvironment(this.kubeconfig),
      });
    } catch (error) {
      throw new Error(`Failed to create Kubernetes secret: ${error}`);
    }
  }

  async updateSecret(name: string, namespace: string, data: Record<string, string>): Promise<void> {
    const secretData = Object.entries(data)
      .map(([key, value]) => `${key}=${Buffer.from(value).toString('base64')}`)
      .join(',');

    const command = `kubectl create secret generic ${name} --from-literal=${secretData} --namespace=${namespace} --dry-run=client -o yaml | kubectl apply -f -`;

    try {
      await execAsync(command, {
        env: buildKubectlEnvironment(this.kubeconfig),
      });
    } catch (error) {
      throw new Error(`Failed to update Kubernetes secret: ${error}`);
    }
  }

  async getSecret(name: string, namespace: string): Promise<Record<string, string>> {
    try {
      const { stdout } = await execAsync(`kubectl get secret ${name} -n ${namespace} -o json`, {
        env: buildKubectlEnvironment(this.kubeconfig),
      });

      const secret = JSON.parse(stdout) as { data?: Record<string, string> };
      const data: Record<string, string> = {};

      for (const [key, value] of Object.entries(secret.data ?? {})) {
        data[key] = Buffer.from(value as string, 'base64').toString('utf8');
      }

      return data;
    } catch (error) {
      throw new Error(`Failed to get Kubernetes secret: ${error}`);
    }
  }

  async deleteSecret(name: string, namespace: string): Promise<void> {
    try {
      await execAsync(`kubectl delete secret ${name} --namespace=${namespace}`, {
        env: buildKubectlEnvironment(this.kubeconfig),
      });
    } catch (error) {
      throw new Error(`Failed to delete Kubernetes secret: ${error}`);
    }
  }

  async createConfigMap(
    name: string,
    namespace: string,
    data: Record<string, string>
  ): Promise<void> {
    const dataArguments = Object.entries(data)
      .map(([key, value]) => `--from-literal=${key}=${value}`)
      .join(' ');

    const command = `kubectl create configmap ${name} ${dataArguments} --namespace=${namespace}`;

    try {
      await execAsync(command, {
        env: buildKubectlEnvironment(this.kubeconfig),
      });
    } catch (error) {
      throw new Error(`Failed to create Kubernetes configmap: ${error}`);
    }
  }

  async injectSecretsIntoDeployment(
    deploymentName: string,
    namespace: string,
    secretReferences: Record<string, string>
  ): Promise<void> {
    // This would patch the deployment to mount secrets as environment variables or volumes
    const patch = {
      spec: {
        template: {
          spec: {
            containers: [
              {
                name: deploymentName,
                envFrom: [
                  {
                    secretRef: {
                      name: Object.values(secretReferences)[0], // Simplified - would need more complex logic
                    },
                  },
                ],
              },
            ],
          },
        },
      },
    };

    const patchJson = JSON.stringify(patch);
    const command = `kubectl patch deployment ${deploymentName} -n ${namespace} --type merge -p '${patchJson}'`;

    try {
      await execAsync(command, {
        env: buildKubectlEnvironment(this.kubeconfig),
      });
    } catch (error) {
      throw new Error(`Failed to inject secrets into deployment: ${error}`);
    }
  }

  async getPodLogs(podName: string, namespace: string, tail = 100): Promise<string> {
    try {
      const { stdout } = await execAsync(`kubectl logs ${podName} -n ${namespace} --tail=${tail}`, {
        env: buildKubectlEnvironment(this.kubeconfig),
      });
      return stdout;
    } catch (error) {
      throw new Error(`Failed to get pod logs: ${error}`);
    }
  }

  async listSecrets(namespace: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        `kubectl get secrets -n ${namespace} -o jsonpath='{.items[*].metadata.name}'`,
        {
          env: buildKubectlEnvironment(this.kubeconfig),
        }
      );
      return stdout
        .trim()
        .split(' ')
        .filter((name) => name);
    } catch (error) {
      throw new Error(`Failed to list Kubernetes secrets: ${error}`);
    }
  }
}

export class ContainerOrchestrator {
  constructor(
    private readonly docker?: DockerIntegration,
    private readonly kubernetes?: K8sIntegration
  ) {}

  async deployApplication(
    name: string,
    config: ContainerConfig | KubernetesConfig,
    useKubernetes = false
  ): Promise<void> {
    if (useKubernetes && this.kubernetes) {
      await this.deployToKubernetes(name, config as KubernetesConfig);
    } else if (this.docker) {
      await this.deployToDocker(name, config as ContainerConfig);
    } else {
      throw new Error('No container runtime configured');
    }
  }

  private async deployToDocker(name: string, config: ContainerConfig): Promise<void> {
    if (!this.docker) {
      throw new Error('Docker integration not configured');
    }

    const containerId = await this.docker.createContainer(name, config);
    console.info(`Created Docker container: ${containerId}`);

    if (config.secrets) {
      await this.docker.injectSecrets(containerId, config.secrets);
      console.info(`Injected secrets into container: ${containerId}`);
    }
  }

  private async deployToKubernetes(_name: string, config: KubernetesConfig): Promise<void> {
    if (!this.kubernetes) {
      throw new Error('Kubernetes integration not configured');
    }

    // Create secrets
    for (const [secretName, secretData] of Object.entries(config.secrets)) {
      await this.kubernetes.createSecret(secretName, config.namespace, secretData);
      console.info(`Created Kubernetes secret: ${secretName}`);
    }

    // Create config maps
    for (const [configName, configData] of Object.entries(config.configMaps)) {
      await this.kubernetes.createConfigMap(configName, config.namespace, configData);
      console.info(`Created Kubernetes configmap: ${configName}`);
    }
  }

  async getLogs(name: string, namespace?: string, tail = 100): Promise<string> {
    if (this.kubernetes && namespace) {
      return await this.kubernetes.getPodLogs(name, namespace, tail);
    } else if (this.docker) {
      return await this.docker.getContainerLogs(name, tail);
    } else {
      throw new Error('No container runtime configured');
    }
  }

  async cleanup(name: string, namespace?: string): Promise<void> {
    if (this.kubernetes && namespace) {
      // Clean up Kubernetes resources
      for (const secretName of await this.kubernetes.listSecrets(namespace)) {
        if (secretName.startsWith(name)) {
          await this.kubernetes.deleteSecret(secretName, namespace);
        }
      }
    } else if (this.docker) {
      const containers = await this.docker.listContainers();
      const container = containers.find((c) => c.name === name);
      if (container) {
        await this.docker.stopContainer(container.id);
        await this.docker.removeContainer(container.id);
      }
    }
  }
}
