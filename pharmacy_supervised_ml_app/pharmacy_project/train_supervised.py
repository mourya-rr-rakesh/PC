import argparse
import ast
import os
import pickle
import re
import tempfile
from pathlib import Path

from numpy import float32
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import KNeighborsClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split


def load_training_data(data_path, target_column, name_column=None):
    data_path = Path(data_path)
    file_type = data_path.suffix.lower()

    if file_type == ".csv":
        columns = pd.read_csv(data_path, nrows=0).columns
        read_data = lambda usecols: pd.read_csv(
            data_path, usecols=usecols, dtype="string", low_memory=False
        )
    elif file_type in {".xlsx", ".xls"}:
        columns = pd.read_excel(data_path, nrows=0).columns
        read_data = lambda usecols: pd.read_excel(
            data_path, usecols=usecols, dtype="string"
        )
    else:
        raise ValueError("Data file must be a .csv, .xls, or .xlsx file.")

    normalized_columns = {str(column).strip().casefold(): column for column in columns}
    if name_column:
        name_column = normalized_columns.get(name_column.strip().casefold())
    else:
        name_column = next(
            (
                normalized_columns[key]
                for key in ("medicine name", "name", "brand_name")
                if key in normalized_columns
            ),
            None,
        )
    target_key = target_column.strip().casefold()
    actual_target_column = normalized_columns.get(target_key)

    if name_column is None:
        raise ValueError("Dataset must contain a 'Medicine Name' or 'name' column.")
    if actual_target_column is None:
        raise ValueError(
            f"Target column '{target_column}' not found. "
            f"Available columns: {', '.join(map(str, columns))}"
        )

    df = read_data([name_column, actual_target_column])
    X = df[name_column].str.strip()
    y = df[actual_target_column].str.strip()
    if target_key == "active_ingredients":
        def format_ingredients(value):
            try:
                ingredients = ast.literal_eval(value)
            except (ValueError, SyntaxError):
                return pd.NA
            if not isinstance(ingredients, list) or not ingredients:
                return pd.NA
            descriptions = [
                str(item.get("full_description", "")).strip()
                for item in ingredients
                if isinstance(item, dict)
            ]
            descriptions = [description for description in descriptions if description]
            return " + ".join(descriptions) if descriptions else pd.NA

        y = y.map(format_ingredients).astype("string")
    valid_rows = X.notna() & X.ne("") & y.notna() & y.ne("")
    clean_data = pd.DataFrame({"name": X[valid_rows], "label": y[valid_rows]})
    clean_data["name_key"] = clean_data["name"].str.casefold()

    labels_per_name = clean_data.groupby("name_key")["label"].nunique()
    conflicting_names = labels_per_name[labels_per_name > 1].index
    clean_data = clean_data[~clean_data["name_key"].isin(conflicting_names)]
    clean_data = clean_data.drop_duplicates(subset="name_key")

    if clean_data.empty:
        raise ValueError("No valid, unambiguous name/target rows remain in the dataset.")
    if (
        target_column.strip().casefold() != "active_ingredients"
        and clean_data["label"].value_counts().min() < 2
    ):
        raise ValueError("Each target class must have at least two distinct medicine names.")

    print(f"Rows skipped for blank name/target: {int((~valid_rows).sum())}")
    print(f"Conflicting medicine names skipped: {len(conflicting_names)}")
    print(f"Unique medicine names used: {len(clean_data)}")
    return clean_data["name"], clean_data["label"], actual_target_column


def build_vectorizer():
    return TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(2, 5),
        max_features=20000,
        dtype=float32,
    )


def build_classifier(algorithm, record_count):
    if algorithm == "knn":
        return KNeighborsClassifier(
            n_neighbors=min(5, record_count),
            weights="distance",
            metric="cosine",
            algorithm="brute",
            n_jobs=-1,
        )
    return LogisticRegression(max_iter=300, solver="lbfgs")


def default_output_path(target_column):
    if target_column.strip().casefold() == "composition":
        return Path(__file__).resolve().parent / "supervised_model.pkl"
    slug = re.sub(r"[^a-z0-9]+", "_", target_column.strip().casefold()).strip("_")
    return Path(__file__).resolve().parent / f"{slug}_model.pkl"


def train_and_evaluate(data_path, target_column, name_column, algorithm, output_path):
    print(f"Loading dataset: {data_path}")
    X, y, actual_target_column = load_training_data(
        data_path, target_column, name_column
    )
    if algorithm == "knn":
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        evaluation_count = min(2000, len(X_test))
        evaluation_indexes = X_test.sample(
            n=evaluation_count, random_state=42
        ).index
        X_eval = X_test.loc[evaluation_indexes]
        y_eval = y_test.loc[evaluation_indexes]
        print(
            f"Evaluating cosine KNN on {len(X_eval)} sampled held-out names "
            f"from a {len(X_test)}-name test split..."
        )
        vectorizer = build_vectorizer()
        X_train_vec = vectorizer.fit_transform(X_train)
        evaluation_model = build_classifier(algorithm, len(X_train))
        evaluation_model.fit(X_train_vec, y_train)
        predictions = evaluation_model.predict(vectorizer.transform(X_eval))
    else:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        print(f"Evaluating on a held-out test set ({len(X_test)} medicine names)...")
        vectorizer = build_vectorizer()
        X_train_vec = vectorizer.fit_transform(X_train)
        evaluation_model = build_classifier(algorithm, len(X_train))
        evaluation_model.fit(X_train_vec, y_train)
        predictions = evaluation_model.predict(vectorizer.transform(X_test))
        y_eval = y_test

    print(f"Test accuracy: {accuracy_score(y_eval, predictions):.4f}")
    print(f"Test macro F1: {f1_score(y_eval, predictions, average='macro'):.4f}")
    print(classification_report(y_eval, predictions, zero_division=0, digits=3))

    print(f"Training final {algorithm.upper()} model on all cleaned names...")
    final_vectorizer = build_vectorizer()
    X_vec = final_vectorizer.fit_transform(X)
    final_model = build_classifier(algorithm, len(X))
    final_model.fit(X_vec, y)
    model_data = {
        "vectorizer": final_vectorizer,
        "model": final_model,
        "training_records": len(X),
        "target_column": actual_target_column,
        "algorithm": algorithm,
    }
    output_path = Path(output_path) if output_path else default_output_path(target_column)
    if not output_path.is_absolute():
        output_path = Path(__file__).resolve().parent / output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb",
            dir=output_path.parent,
            prefix=f"{output_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as model_file:
            temp_path = Path(model_file.name)
            pickle.dump(model_data, model_file)
        os.replace(temp_path, output_path)
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)

    print(f"Final model trained on {len(X)} records across {y.nunique()} classes.")
    print(f"Saved trained model to: {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--data",
        default="Medicine_Details.xlsx",
        help="Path to a .xlsx, .xls, or .csv file",
    )
    parser.add_argument(
        "--target",
        default="Composition",
        help="Label column to predict",
    )
    parser.add_argument(
        "--name-column",
        help="Input medicine-name column (auto-detected by default)",
    )
    parser.add_argument(
        "--algorithm",
        choices=("logistic", "knn"),
        default="logistic",
        help="Use logistic regression for normal labels or cosine KNN for many labels",
    )
    parser.add_argument(
        "--output",
        help="Path to save the model; default is based on the target column",
    )
    args = parser.parse_args()
    train_and_evaluate(
        args.data,
        args.target,
        args.name_column,
        args.algorithm,
        args.output,
    )
