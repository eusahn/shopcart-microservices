# Tilt drives the local dev loop on minikube:
#   1. Builds each service's image inside the minikube docker daemon (no push)
#   2. Helm-renders + applies its chart
#   3. Watches the source tree and live-rebuilds on save
#
# Usage:   tilt up    (UI at http://localhost:10350)
# Prereq:  the platform is already installed via platform/bootstrap/all.sh

load('ext://restart_process', 'docker_build_with_restart')

# Use the minikube docker daemon so images don't need to be pushed.
# Run `eval $(minikube -p shopcart docker-env)` in the shell that launches tilt
# OR uncomment the line below to do it from Tilt:
# local('eval $(minikube -p shopcart docker-env --shell bash)')

allow_k8s_contexts('minikube-shopcart')

SERVICES = [
    'api-gateway',
    'catalog-service',
    'cart-service',
    'user-service',
    'order-service',
    'inventory-service',
    'payment-service',
    'notification-service',
]

# The frontend is also a "service" from k8s's POV but lives in /frontend
# and is built with a different Dockerfile.
docker_build(
    ref='shopcart/frontend',
    context='.',
    dockerfile='frontend/Dockerfile',
    only=['./frontend', './pnpm-workspace.yaml', './package.json'],
)
k8s_yaml(helm(
    'platform/helm/service',
    name='frontend',
    namespace='shopcart',
    values=['platform/helm/values/frontend.yaml'],
))
k8s_resource('frontend', labels=['ui'], port_forwards=['8081:8080'])

# Shared build context — every service uses the root Dockerfile with a SERVICE build arg.
for svc in SERVICES:
    docker_build(
        ref='shopcart/{}'.format(svc),
        context='.',
        dockerfile='Dockerfile',
        build_args={'SERVICE': svc},
        only=[
            './package.json',
            './pnpm-workspace.yaml',
            './turbo.json',
            './tsconfig.base.json',
            './buf.yaml',
            './buf.gen.yaml',
            './proto',
            './packages',
            './services/{}'.format(svc),
        ] + ['./services/{}'.format(s) for s in SERVICES if s != svc],
    )

    k8s_yaml(helm(
        'platform/helm/service',
        name=svc,
        namespace='shopcart',
        values=['platform/helm/values/{}.yaml'.format(svc)],
    ))

    k8s_resource(
        svc,
        labels=['services'],
        port_forwards=[] if svc != 'api-gateway' else ['8080:8080'],
    )

# Ingress
k8s_yaml('platform/helm/ingress.yaml')

# Group dependencies for the UI
k8s_resource(new_name='infra', objects=[], labels=['infra'])

print("""
🛒  ShopCart dev loop
   • Gateway:  http://localhost:8080  (or http://shop.local via ingress)
   • Grafana:  http://grafana.local   (admin/admin)
   • Argo CD:  http://argocd.local
   • Linkerd:  linkerd viz dashboard
""")
