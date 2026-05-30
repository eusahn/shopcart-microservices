{{- define "svc.name" -}}
{{- required "serviceName is required" .Values.serviceName -}}
{{- end -}}

{{- define "svc.labels" -}}
app.kubernetes.io/name: {{ include "svc.name" . }}
app.kubernetes.io/part-of: shopcart
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end -}}

{{- define "svc.selector" -}}
app.kubernetes.io/name: {{ include "svc.name" . }}
{{- end -}}

{{- define "svc.podAnnotations" -}}
{{- if .Values.linkerd.inject }}
linkerd.io/inject: enabled
config.linkerd.io/proxy-await: "enabled"
{{- /* Bypass Linkerd entirely for Redis (6379) and Kafka (9092). opaque-ports
       wasn't enough — proxy still hangs on service discovery. Skip-ports means
       traffic goes directly without mTLS or interception. */}}
config.linkerd.io/skip-outbound-ports: "6379,9092"
config.linkerd.io/skip-inbound-ports:  "6379,9092"
{{- end }}
prometheus.io/scrape: "true"
prometheus.io/port: "{{ .Values.ports.metrics }}"
prometheus.io/path: "/metrics"
{{- end -}}
