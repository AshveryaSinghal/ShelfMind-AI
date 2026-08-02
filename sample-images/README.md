# Sample Test Images

A handful of real shelf photos for anyone trying ShelfMind out (e.g. a
recruiter) without needing their own shelf photo on hand.

Sourced from the [SKU-110K dataset](https://www.kaggle.com/datasets/thedatasith/sku110k-annotations)
validation split, used only for offline demo/testing purposes -- these
are the same kind of images the detection model (`models/best.pt`) was
fine-tuned on, so they'll produce representative results.

## How to use

1. Go to the **New Scan** page.
2. Upload any `.jpg` from this folder (or drag-and-drop it).
3. Enter any Shelf ID (e.g. `DEMO-1`) and submit.

## How these were obtained

Downloaded via a Kaggle notebook -- see the steps in the main
[README's "Sample Test Images" section](../README.md#sample-test-images)
if you need to regenerate or add more.
