pipeline {
    agent any

    parameters {
        booleanParam(name: 'PUSH_IMAGE', defaultValue: true, description: 'Push Docker image after build?')
        booleanParam(name: 'DEPLOY_TO_ARGOCD', defaultValue: true, description: 'Deploy to ArgoCD after build? Set to false to skip deployment.')
        string(name: 'IGNORED_CATEGORIES', defaultValue: '', description: 'Comma-separated list of categories to ignore when processing data from the DB')
    }

    environment {
        IMAGE_NAME = 'osmosmjerka'
        BACKEND_DIR = 'backend'
        FRONTEND_DIR = 'frontend'
        GITOPS_REPO = "${env.OSMOSMJERKA_GITOPS_REPO}"
        ADMIN_USERNAME = credentials('osmosmjerka-admin-username')
        ADMIN_PASSWORD_HASH = credentials('osmosmjerka-admin-password-hash')
        ADMIN_SECRET_KEY = credentials('osmosmjerka-admin-secret-key')
        IGNORED_CATEGORIES = "${params.IGNORED_CATEGORIES ?: env.IGNORED_CATEGORIES}"
    }

    stages {
        stage('Checkout') {
            steps {
                // Ensure full clone with history and tags
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    doGenerateSubmoduleConfigurations: false,
                    extensions: [
                        [$class: 'CloneOption', noTags: false, shallow: false, depth: 0]
                    ],
                    submoduleCfg: [],
                    userRemoteConfigs: [[url: 'git@github.com:bartekmp/osmosmjerka.git', credentialsId: 'github_token']]
                ])
            }
        }
        stage('Install Dependencies') {
            steps {
                dir("${FRONTEND_DIR}") {
                    sh 'npm i'
                }
                dir("${BACKEND_DIR}") {
                    sh 'python3 -m venv .venv'
                    sh '. .venv/bin/activate && pip install --upgrade pip'
                    sh '. .venv/bin/activate && pip install .[dev]'
                }
            }
        }

        stage('Build & Test') {
            parallel {
                stage('Backend') {
                    stages {
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
                                        if (fileExists('tests') && sh(script: 'ls tests/test_*.py 2>/dev/null | wc -l', returnStdout: true).trim() != '0') {
                                            sh '. .venv/bin/activate && pytest'
                                        } else {
                                            echo 'No backend tests found, skipping.'
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                stage('Frontend') {
                    stages {
                        stage('Lint & Format') {
                            steps {
                                dir("${FRONTEND_DIR}") {
                                    script {
                                        if (fileExists('node_modules/.bin/eslint')) {
                                            sh 'npx eslint . || true'
                                        } else {
                                            echo 'No ESLint found, skipping lint.'
                                        }
                                        if (fileExists('node_modules/.bin/prettier')) {
                                            sh 'npx prettier --check . || true'
                                        } else {
                                            echo 'No Prettier found, skipping formatting check.'
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
                                            echo 'No frontend tests found, skipping.'
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

        stage('Semantic Release') {
            when {
                allOf {
                    branch 'main'
                    not { buildingTag() }
                }
            }
            steps {
                sh 'npx semantic-release --dry-run > release.log'
                script {
                    def version = sh(script: "grep 'next release version is' release.log | awk '{print \$NF}'", returnStdout: true).trim()
                    env.IMAGE_TAG = version
                    echo "Next version: ${version}"
                    dir('frontend') {
                        sh "npm version ${version} --no-git-tag-version"
                    }
                    dir('backend') {
                        sh "sed -i 's/^version = \".*\"/version = \"${version}\"/' pyproject.toml"
                    }
                }
            }
        }

        stage('Release') {
            when {
                allOf {
                    branch 'main'
                    not { buildingTag() }
                }
            }
            steps {
                dir('frontend') {
                    sh 'npx semantic-release'
                }
                dir('backend') {
                    sh 'semantic-release publish'
                }
            }
        }

        stage('Prepare .env') {
            when {
                allOf {
                    branch 'main'
                    not { buildingTag() }
                }
            }
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
            when {
                allOf {
                    branch 'main'
                    not { buildingTag() }
                }
            }
            steps {
                script {
                    sh "docker build -t ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:latest -t ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} ."
                    if (params.PUSH_IMAGE) {
                        sh "docker push ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:latest"
                        sh "docker push ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
                    }
                }
            }
        }

        stage('Deploy to Argo CD') {
            when {
                branch 'main'
                not { buildingTag() }
            }
            steps {
                script {
                    if (!params.GITOPS_REPO?.trim()) {
                        echo 'Skipping deployment to ArgoCD because GITOPS_REPO is not set.'
                    } else if (params.DEPLOY_TO_ARGOCD) {
                        sh 'rm -rf gitops-tmp'
                        sh "git clone ${params.GITOPS_REPO} gitops-tmp"
                        dir('gitops-tmp/k8s/overlays/prod') {
                            sh "kustomize edit set image ${env.DOCKER_REGISTRY}/${IMAGE_NAME}=${env.DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
                            sh 'git config user.email "ci@example.com"'
                            sh 'git config user.name "CI Bot"'
                            sh 'git commit -am "Update prod image to ${IMAGE_TAG}" || echo \"No changes to commit\"'
                            sh 'git push'
                        }
                        sh 'rm -rf gitops-tmp'
                    } else {
                        echo 'Skipping deployment to ArgoCD as per user request.'
                    }
                }
            }
        }
    }
    post {
        always {
            sh "docker rm ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:latest || true"
            sh "docker rm ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG} || true"
            sh 'rm -f .env'
            cleanWs()
        }
    }
}
