pipeline {
    agent any

    parameters {
        string(name: 'DOCKER_REGISTRY', defaultValue: '', description: 'Docker registry address, e.g. my-registry.com:123')
        string(name: 'DEPLOY_TO_ARGOCD', defaultValue: true, description: 'Deploy to ArgoCD after build? Set to false to skip deployment.')
        string(name: 'ADMIN_USERNAME', defaultValue: 'admin', description: 'Username for the admin account used to access the application')
        string(name: 'ADMIN_PASSWORD_HASH', defaultValue: '', description: 'Password hash for the admin account used to access the application')
        string(name: 'ADMIN_SECRET_KEY', defaultValue: '', description: 'Secret key for the admin account used to access the application')
        string(name: 'IGNORED_CATEGORIES', defaultValue: '', description: 'Comma-separated list of categories to ignore when processing data from the DB')        
    }

    environment {
        IMAGE_NAME = "osmosmjerka"
        BACKEND_DIR = "backend"
        FRONTEND_DIR = "frontend"
        VERSION_FILE = "VERSION"
    }

    stages {
        stage('Read Version') {
            steps {
                script {
                    VERSION = readFile("${VERSION_FILE}").trim()
                    env.IMAGE_TAG = VERSION
                }
            }
        }

        stage('Build & Test') {
            parallel {
                stage('Backend') {
                    stages {
                        stage('Setup Python') {
                            steps {
                                dir("${BACKEND_DIR}") {
                                    sh 'python3 -m venv .venv'
                                    sh '. .venv/bin/activate && pip install --upgrade pip'
                                    sh '. .venv/bin/activate && pip install .[dev]'
                                }
                            }
                        }
                        stage('Lint & Format') {
                            steps {
                                dir("${BACKEND_DIR}") {
                                    sh '. .venv/bin/activate && isort --check-only .'
                                    sh '. .venv/bin/activate && black --check --diff .'
                                }
                            }
                        }
                        stage('Unit Tests') {
                            steps {
                                dir("${BACKEND_DIR}") {
                                    script {
                                        if (fileExists('tests') && sh(script: 'ls tests/test_*.py 2>/dev/null | wc -l', returnStdout: true).trim() != "0") {
                                            sh '. .venv/bin/activate && pytest'
                                        } else {
                                            echo "No backend tests found, skipping."
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                stage('Frontend') {
                    stages {
                        stage('Install Node Modules') {
                            steps {
                                dir("${FRONTEND_DIR}") {
                                    sh 'npm install'
                                }
                            }
                        }
                        stage('Lint & Format') {
                            steps {
                                dir("${FRONTEND_DIR}") {
                                    script {
                                        if (fileExists('node_modules/.bin/eslint')) {
                                            sh 'npx eslint . || true'
                                        } else {
                                            echo "No ESLint found, skipping lint."
                                        }
                                        if (fileExists('node_modules/.bin/prettier')) {
                                            sh 'npx prettier --check . || true'
                                        } else {
                                            echo "No Prettier found, skipping formatting check."
                                        }
                                    }
                                }
                            }
                        }
                        stage('Unit Tests') {
                            steps {
                                dir("${FRONTEND_DIR}") {
                                    script {
                                        if (fileExists('node_modules/.bin/jest')) {
                                            sh 'npx jest'
                                        } else {
                                            echo "No frontend tests found, skipping."
                                        }
                                    }
                                }
                            }
                        }
                        stage('Build') {
                            steps {
                                dir("${FRONTEND_DIR}") {
                                    sh 'npm run build'
                                }
                            }
                        }
                    }
                }
            }
        }

        stage('Prepare .env') {
            steps {
                script {
                    writeFile file: '.env', text: """
ADMIN_USERNAME=${env.ADMIN_USERNAME}
ADMIN_PASSWORD_HASH=${env.ADMIN_PASSWORD_HASH}
ADMIN_SECRET_KEY=${env.ADMIN_SECRET_KEY}
IGNORED_CATEGORIES=${env.IGNORED_CATEGORIES}
""".stripIndent()
                }
            }
        }

        stage('Docker Build & Push') {
            steps {
                script {
                    sh "docker build -t ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:latest -t ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} ."
                    sh "docker push ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:latest"
                    sh "docker push ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
                }
            }
        }

        stage('Deploy to ArgoCD') {
            when {
                branch 'main'
            }
            steps {
                script {
                    if (params.DEPLOY_TO_ARGOCD.toBoolean()) {
                        // Clone the GitOps repo, update image, commit, and push to trigger ArgoCD deployment
                        sh 'rm -rf gitops-tmp'
                        sh "git clone ${params.GITOPS_REPO} gitops-tmp"
                        dir('gitops-tmp/k8s/overlays/prod') {
                            sh "kustomize edit set image ${env.DOCKER_REGISTRY}/${IMAGE_NAME}=${env.DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
                            sh 'git config user.email "ci@example.com"'
                            sh 'git config user.name "CI Bot"'
                            sh 'git commit -am "Update prod image to ${IMAGE_TAG}" || echo "No changes to commit"'
                            sh 'git push'
                        }
                        sh 'rm -rf gitops-tmp'
                    } else {
                        echo "Skipping deployment to ArgoCD as per user request."
                    }
                }
            }
        }
    }
    post {
        always {
            sh 'rm -f .env'
            cleanWs()
        }
    }
}