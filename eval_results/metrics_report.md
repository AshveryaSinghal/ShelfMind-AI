# ShelfMind Detection Model — Evaluation Report

- **Weights**: `/kaggle/input/models/ashveryasinghal/sku110/pytorch/default/1/best.pt`
- **Validation set**: `/kaggle/working/data.yaml`
- **Device**: 0 · **Image size**: 640
- **Ultralytics**: 8.4.106 · **Python**: 3.12.13

## Headline Metrics

| Metric | Value |
|---|---|
| Precision | 0.9093 |
| Recall | 0.8431 |
| F1 | 0.8749 |
| mAP50 | 0.8875 |
| mAP50-95 | 0.5557 |

## Confidence Threshold Sweep

| Confidence | Precision | Recall | F1 | mAP50 |
|---|---|---|---|---|
| 0.1 | 0.9082 | 0.8626 | 0.8848 | 0.8852 |
| 0.2 | 0.9082 | 0.8626 | 0.8848 | 0.8682 |
| 0.25 | 0.9064 | 0.8639 | 0.8846 | 0.8593 |
| 0.35 | 0.9225 | 0.8468 | 0.883 | 0.832 |
| 0.5 | 0.9535 | 0.7887 | 0.8633 | 0.7755 |
| 0.6 | 0.9704 | 0.7278 | 0.8318 | 0.7177 |
| 0.75 | 0.9917 | 0.4287 | 0.5987 | 0.4225 |

**Best F1 at confidence = 0.1** (F1 = 0.8848). Compare against the deployed threshold in `shelfmind/config.py:DetectionConfig.confidence_threshold` before changing it — that value was last tuned against real-world recall, not just this offline sweep.

## Inference Speed

Measured over 50 forward passes on this machine (Linux-6.12.90+-x86_64-with-glibc2.35, device=0):

| Stat | Value |
|---|---|
| Mean | 10.9 ms (91.75 FPS) |
| Median | 10.9 ms |
| P95 | 11.13 ms |
| Min / Max | 10.56 ms / 11.57 ms |

## Artifacts

- `confusion_matrix.png`, `pr_curve.png` — see `val/` subfolder (written by Ultralytics)
- `sample_predictions/` — 12 annotated validation images
- `confidence_sweep.csv` — machine-readable version of the sweep table above
- `summary.json` — every number in this report, plus full run metadata