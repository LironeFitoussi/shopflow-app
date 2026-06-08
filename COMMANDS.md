# ShopFlow – kubectl Command Reference

---

## Deploy

```bash
# Start Minikube
minikube start

# Create namespace
kubectl apply -f k8s/namespace.yaml

# Deploy Postgres
kubectl apply -f k8s/postgres/deployment.yaml
kubectl apply -f k8s/postgres/service.yaml

# Deploy Redis
kubectl apply -f k8s/redis/deployment.yaml
kubectl apply -f k8s/redis/service.yaml

# Deploy Backend
kubectl apply -f k8s/backend/deployment.yaml
kubectl apply -f k8s/backend/service.yaml

# Deploy Frontend
kubectl apply -f k8s/frontend/deployment.yaml
kubectl apply -f k8s/frontend/service.yaml

# Apply everything at once
kubectl apply -f k8s/namespace.yaml \
  -f k8s/postgres/deployment.yaml \
  -f k8s/postgres/service.yaml \
  -f k8s/redis/deployment.yaml \
  -f k8s/redis/service.yaml \
  -f k8s/backend/deployment.yaml \
  -f k8s/backend/service.yaml \
  -f k8s/frontend/deployment.yaml \
  -f k8s/frontend/service.yaml
```

---

## Access the App

```bash
# Open frontend in browser (NodePort 30080)
minikube service frontend-service -n shopflow

# Or get the URL manually
minikube ip
# Then open: http://<minikube-ip>:30080
```

---

## Status & Inspection

```bash
# All resources in namespace
kubectl get all -n shopflow

# Pods only
kubectl get pods -n shopflow

# Watch pods live
kubectl get pods -n shopflow -w

# Services
kubectl get svc -n shopflow

# Deployments
kubectl get deployments -n shopflow

# Describe a pod (replace <pod-name>)
kubectl describe pod <pod-name> -n shopflow

# Describe a deployment
kubectl describe deployment backend -n shopflow

# Check events (useful for debugging)
kubectl get events -n shopflow --sort-by='.lastTimestamp'
```

---

## Logs

```bash
# Backend logs
kubectl logs deployment/backend -n shopflow

# Stream backend logs live
kubectl logs deployment/backend -n shopflow -f

# Last 50 lines
kubectl logs deployment/backend -n shopflow --tail=50

# Logs from a specific pod
kubectl logs <pod-name> -n shopflow
```

---

## Exec into Pods

```bash
# Shell into backend pod
kubectl exec -it deployment/backend -n shopflow -- sh

# Shell into postgres pod
kubectl exec -it deployment/postgres -n shopflow -- sh

# Run psql directly
kubectl exec -it deployment/postgres -n shopflow -- \
  psql -U shopuser -d shopflow

# Redis CLI
kubectl exec -it deployment/redis -n shopflow -- redis-cli
```

---

## Scaling

```bash
# Scale backend to 4 replicas
kubectl scale deployment backend --replicas=4 -n shopflow

# Scale back to 2
kubectl scale deployment backend --replicas=2 -n shopflow

# Scale to zero (simulate outage)
kubectl scale deployment backend --replicas=0 -n shopflow
```

---

## Rolling Updates & Rollback

```bash
# Trigger rolling restart (no config change needed)
kubectl rollout restart deployment/backend -n shopflow

# Watch rollout progress
kubectl rollout status deployment/backend -n shopflow

# View rollout history
kubectl rollout history deployment/backend -n shopflow

# Rollback to previous version
kubectl rollout undo deployment/backend -n shopflow
```

---

## Health Probes

```bash
# Check liveness/readiness probe config
kubectl describe pod -l app=backend -n shopflow | grep -A 8 "Liveness"
kubectl describe pod -l app=backend -n shopflow | grep -A 8 "Readiness"

# Check restart count
kubectl describe pod -l app=backend -n shopflow | grep "Restart Count"
```

---

## Resource Usage

```bash
# Enable metrics-server (Minikube)
minikube addons enable metrics-server

# CPU & memory per pod
kubectl top pods -n shopflow

# CPU & memory per node
kubectl top nodes

# Check allocated resources on node
kubectl describe node | grep -A 10 "Allocated resources"
```

---

## Self-Healing Demo

```bash
# Delete a pod and watch Kubernetes recreate it
# Terminal 1 — watch pods
kubectl get pods -n shopflow -w

# Terminal 2 — delete pod
kubectl delete pod -l app=backend -n shopflow --wait=false
```

---

## Teardown

```bash
# Delete everything in namespace
kubectl delete namespace shopflow

# Or delete resource by resource
kubectl delete -f k8s/ -n shopflow --recursive
```
