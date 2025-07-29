pipeline {
    agent any

    parameters {
        booleanParam(name: 'DEPLOY_TO_ARGOCD', defaultValue: true, description: 'Deploy to ArgoCD after build? Set to false to skip deployment.')
        booleanParam(name: 'SKIP_IMAGE_PUSH', defaultValue: false, description: 'Skip Docker image push? Set to false to skip.')
        string(name: 'IGNORED_CATEGORIES', defaultValue: '', description: 'Comma-separated list of categories to ignore when processing data from the DB')
    }

    environment {
        IMAGE_NAME = 'osmosmjerka'
        BACKEND_DIR = 'backend'
        FRONTEND_DIR = 'frontend'
        IGNORED_CATEGORIES = "${params.IGNORED_CATEGORIES ?: env.IGNORED_CATEGORIES}"

        GITOPS_REPO = "${env.OSMOSMJERKA_GITOPS_REPO}"

        ADMIN_USERNAME = credentials('osmosmjerka-admin-username')
        ADMIN_PASSWORD_HASH = credentials('osmosmjerka-admin-password-hash')
        ADMIN_SECRET_KEY = credentials('osmosmjerka-admin-secret-key')
        POSTGRES_DATABASE = "${env.OSMOSMJERKA_POSTGRES_DATABASE}"
        POSTGRES_HOST = "${env.OSMOSMJERKA_POSTGRES_HOST}"
        POSTGRES_PORT = "${env.OSMOSMJERKA_POSTGRES_PORT}"
        POSTGRES_USER = credentials('osmosmjerka-db-user')
        POSTGRES_PASSWORD = credentials('osmosmjerka-db-password')

        DEPLOY_TO_ARGOCD_PARAM = "${params.DEPLOY_TO_ARGOCD.toString()}"
        SKIP_IMAGE_PUSH_PARAM = "${params.SKIP_IMAGE_PUSH.toString()}"
        GH_TOKEN = credentials('github_token')
    }

    stages {
        stage('Checkout') {
            steps {
                // Checkout any branch that triggers the build, ensure it has entire history
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '**']],
                    doGenerateSubmoduleConfigurations: false,
                    extensions: [
                        [$class: 'CloneOption', noTags: false, shallow: false, depth: 0],
                        [$class: 'LocalBranch', localBranch: env.BRANCH_NAME]
                    ],
                    submoduleCfg: [],
                    userRemoteConfigs: [[url: 'git@github.com:bartekmp/osmosmjerka.git', credentialsId: 'github_token']]
                ])
                sh 'git config --global --add safe.directory $PWD'
                sh 'git fetch --tags'
                sh 'git fetch --all'
                sh 'git pull origin main'
                sh 'git describe --tags || echo "No tags found"'
                sh 'echo "Current branch: ${BRANCH_NAME}"'
            }
        }
        stage('Install Dependencies') {
            steps {
                dir("${FRONTEND_DIR}") {
                    sh 'npm i'
                }
                dir("${WORKSPACE}") {
                    sh '''
                    python3.13 -m venv backend/.venv
                    . backend/.venv/bin/activate
                    pip install --upgrade pip
                    pip install .[dev]
                    '''
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
                                    sh '''
                                    . .venv/bin/activate
                                    flake8 . --exclude=venv*,.venv*,__pycache__ --count --select=E9,F63,F7,F82 --show-source --statistics
                                    flake8 . --exclude=venv*,.venv*,__pycache__ --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics
                                    isort --check-only . || true
                                    black --check --diff . || true
                                    '''
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
                script {
                    env.DEPLOY_TO_ARGOCD = env.DEPLOY_TO_ARGOCD_PARAM ?: 'false'
                    env.SKIP_IMAGE_PUSH = env.SKIP_IMAGE_PUSH_PARAM ?: 'false'
                    env.IS_NEW_RELEASE = 'true'

                    echo "Initial DEPLOY_TO_ARGOCD value: ${env.DEPLOY_TO_ARGOCD}"
                    echo "Initial SKIP_IMAGE_PUSH value: ${env.SKIP_IMAGE_PUSH}"
                    echo "Initial IS_NEW_RELEASE value: ${env.IS_NEW_RELEASE}"

                    def exitCode = sh(
                        script: """
                            . backend/.venv/bin/activate
                            semantic-release --strict version --push
                        """,
                        returnStatus: true
                    )

                    echo "Semantic-release exit code: ${exitCode}"
                    if (exitCode == 0) {
                        echo "Branch: New version released successfully"
                        env.DEPLOY_TO_ARGOCD = 'true'
                        env.SKIP_IMAGE_PUSH = 'false'
                        env.IS_NEW_RELEASE = 'true'
                        echo "Set DEPLOY_TO_ARGOCD to: ${env.DEPLOY_TO_ARGOCD}"
                        echo "Set SKIP_IMAGE_PUSH to: ${env.SKIP_IMAGE_PUSH}"
                        echo "Set IS_NEW_RELEASE to: ${env.IS_NEW_RELEASE}"
                    } else if (exitCode == 2) {
                        echo "Branch: No release necessary or already released, setting DEPLOY_TO_ARGOCD to false"
                        env.DEPLOY_TO_ARGOCD = 'false'
                        env.SKIP_IMAGE_PUSH = 'true'
                        env.IS_NEW_RELEASE = 'false'
                        echo "Set DEPLOY_TO_ARGOCD to: ${env.DEPLOY_TO_ARGOCD}"
                        echo "Set SKIP_IMAGE_PUSH to: ${env.SKIP_IMAGE_PUSH}"
                        echo "Set IS_NEW_RELEASE to: ${env.IS_NEW_RELEASE}"
                        env.IMAGE_TAG = "v999.0.0-dev"
                        return
                    } else {
                        echo "Branch: Unexpected exit code ${exitCode}"
                        error("Semantic-release failed with exit code ${exitCode}")
                    }
                    
                    def version = sh(script: "grep '^version' pyproject.toml | head -1 | awk -F '\"' '{print \$2}'", returnStdout: true).trim()
                    dir('frontend') {
                        echo "Setting frontend version: ${version}"
                        sh "sed -i 's/\"version\": \"[^\"]*\"/\"version\": \"${version}\"/' package.json"
                    }

                    env.IMAGE_TAG = version
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
                script {
                    if (env.IS_NEW_RELEASE == 'false') {
                        echo "No new release, skipping semantic release publish."
                        return
                    }

                    sh '. backend/.venv/bin/activate && semantic-release publish'
                    dir('frontend') {
                        sh 'npx semantic-release'
                    }
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
POSTGRES_HOST=${env.POSTGRES_HOST}
POSTGRES_PORT=${env.POSTGRES_PORT}
POSTGRES_USER=${env.POSTGRES_USER}
POSTGRES_PASSWORD=${env.POSTGRES_PASSWORD}
POSTGRES_DATABASE=${env.POSTGRES_DATABASE}
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
                    sh "docker build -t ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:${env.IMAGE_TAG} . --build-arg VERSION=${env.IMAGE_TAG} --label=\"build_id=${env.BUILD_ID}\" --label=\"version=${env.IMAGE_TAG}\""
                    if (env.SKIP_IMAGE_PUSH != 'true') {
                        if(env.BRANCH_NAME == 'main') {
                            sh "docker tag ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:${env.IMAGE_TAG} ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:latest"
                        }
                        sh "docker push ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:latest"
                        sh "docker push ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:${env.IMAGE_TAG}"
                    }
                    else {
                        echo 'Skipping Docker image push.'
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
                    if (!env.GITOPS_REPO?.trim()) {
                        echo 'Skipping deployment to ArgoCD because GITOPS_REPO is not set.'
                    } else if (env.DEPLOY_TO_ARGOCD == 'true') {
                        sh 'rm -rf gitops-tmp'
                        sh "git clone ${env.GITOPS_REPO} gitops-tmp"
                        dir('gitops-tmp/k8s/overlays/osmosmjerka') {
                            sh "kustomize edit set image ${env.DOCKER_REGISTRY}/${IMAGE_NAME}=${env.DOCKER_REGISTRY}/${IMAGE_NAME}:${env.IMAGE_TAG}"
                            sh 'git config user.email "ci@example.com"'
                            sh 'git config user.name "CI Bot"'
                            sh 'git commit -am "Update prod image to ${IMAGE_TAG}" || echo \"No changes to commit\"'
                            sh 'git push'
                        }
                        sh 'rm -rf gitops-tmp'
                    } else {
                        echo 'Skipping deployment to ArgoCD.'
                    }
                }
            }
        }
    }
    post {
        always {
            script {
                def versionTag = env.BRANCH_NAME == 'main' ? env.IMAGE_TAG : '999.0.0-dev'
                sh "docker rm ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:latest || true"
                sh "docker rm ${env.DOCKER_REGISTRY}/${IMAGE_NAME}:${versionTag} || true"
                sh 'rm -f .env || true'
                sh 'rm -rf gitops-tmp || true'
                sh 'rm -rf frontend/node_modules backend/.venv'
            }
            cleanWs()
        }
    }
}
