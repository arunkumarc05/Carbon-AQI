import pandas as pd
import numpy as np
from pathlib import Path

def main():
    print("🚀 Starting data cleaning process...")
    
    # 1. Load CSV from data/raw/city_day.csv
    print("\n📁 Loading data...")
    input_path = Path("data/raw/city_day.csv")
    df = pd.read_csv(input_path)
    print(f"✅ Loaded data with shape: {df.shape}")
    
    # 2. Print initial shape and null count per column
    print("\n📊 Initial data analysis:")
    print(f"Shape: {df.shape}")
    print("Null counts per column:")
    null_counts = df.isnull().sum()
    for col, null_count in null_counts.items():
        print(f"  {col}: {null_count}")
    
    # 3. Drop rows where AQI or AQI_Bucket is null
    print("\n🗑️  Dropping rows with null AQI or AQI_Bucket...")
    initial_rows = len(df)
    df = df.dropna(subset=['AQI', 'AQI_Bucket'])
    dropped_rows = initial_rows - len(df)
    print(f"✅ Dropped {dropped_rows} rows with null target labels")
    print(f"New shape: {df.shape}")
    
    # 4. For numeric columns, fill nulls with column MEDIAN grouped by City
    print("\n🔧 Filling nulls in numeric columns with city-specific medians...")
    numeric_cols = ['PM2.5', 'PM10', 'NO2', 'CO', 'SO2', 'O3', 'AQI']
    
    for col in numeric_cols:
        if col in df.columns:
            null_before = df[col].isnull().sum()
            if null_before > 0:
                df[col] = df.groupby('City')[col].transform(lambda x: x.fillna(x.median()))
                null_after = df[col].isnull().sum()
                print(f"  {col}: Filled {null_before - null_after} nulls with city medians")
            else:
                print(f"  {col}: No nulls found")
    
    # 5. If after group median fill any nulls remain, fill with overall column median
    print("\n🔧 Filling remaining nulls with overall column medians...")
    for col in numeric_cols:
        if col in df.columns:
            null_before = df[col].isnull().sum()
            if null_before > 0:
                overall_median = df[col].median()
                df[col] = df[col].fillna(overall_median)
                null_after = df[col].isnull().sum()
                print(f"  {col}: Filled {null_before - null_after} remaining nulls with overall median ({overall_median:.2f})")
    
    # 6. Drop columns: NO, NOx, NH3, Benzene, Toluene, Xylene
    print("\n🗑️  Dropping unnecessary columns...")
    cols_to_drop = ['NO', 'NOx', 'NH3', 'Benzene', 'Toluene', 'Xylene']
    existing_cols_to_drop = [col for col in cols_to_drop if col in df.columns]
    df = df.drop(columns=existing_cols_to_drop)
    print(f"✅ Dropped columns: {existing_cols_to_drop}")
    print(f"New shape: {df.shape}")
    
    # 7. Parse Date column to datetime format, extract: Year, Month, DayOfWeek as new columns
    print("\n📅 Processing date column...")
    if 'Datetime' in df.columns:
        df['Date'] = pd.to_datetime(df['Datetime'], format='%d-%m-%Y')
        df['Year'] = df['Date'].dt.year
        df['Month'] = df['Date'].dt.month
        df['DayOfWeek'] = df['Date'].dt.dayofweek  # 0=Monday, 6=Sunday
        print("✅ Created Date, Year, Month, DayOfWeek columns")
        print(f"Date range: {df['Date'].min()} to {df['Date'].max()}")
    else:
        print("❌ Datetime column not found!")
    
    # 8. Rename AQI_Bucket to risk_level and standardize values
    print("\n🏷️  Standardizing risk levels...")
    if 'AQI_Bucket' in df.columns:
        df = df.rename(columns={'AQI_Bucket': 'risk_level'})
        
        # Map original values to standardized ones
        risk_mapping = {
            'Good': 'Low',
            'Satisfactory': 'Low',
            'Moderate': 'Moderate',
            'Poor': 'High',
            'Very Poor': 'High',
            'Severe': 'High'
        }
        
        print("Original risk_level distribution:")
        print(df['risk_level'].value_counts())
        
        df['risk_level'] = df['risk_level'].map(risk_mapping)
        print("✅ Standardized risk levels")
        print("New risk_level distribution:")
        print(df['risk_level'].value_counts())
    else:
        print("❌ AQI_Bucket column not found!")
    
    # 9. Encode risk_level as label: Low=0, Moderate=1, High=2
    print("\n🔢 Encoding risk levels to numeric labels...")
    if 'risk_level' in df.columns:
        label_mapping = {'Low': 0, 'Moderate': 1, 'High': 2}
        df['risk_label'] = df['risk_level'].map(label_mapping)
        print("✅ Created risk_label column")
        print("Risk label distribution:")
        print(df['risk_label'].value_counts().sort_index())
    else:
        print("❌ risk_level column not found!")
    
    # 10. Remove duplicate rows
    print("\n🔄 Removing duplicate rows...")
    initial_rows = len(df)
    df = df.drop_duplicates()
    removed_duplicates = initial_rows - len(df)
    print(f"✅ Removed {removed_duplicates} duplicate rows")
    print(f"New shape: {df.shape}")
    
    # 11. Remove outliers for specified columns
    print("\n📊 Removing outliers...")
    outlier_cols = ['PM2.5', 'PM10', 'NO2', 'CO', 'SO2', 'O3']
    total_outliers_removed = 0
    
    for col in outlier_cols:
        if col in df.columns:
            # Calculate mean and std
            mean_val = df[col].mean()
            std_val = df[col].std()
            
            # Define outlier bounds (3 standard deviations)
            lower_bound = mean_val - 3 * std_val
            upper_bound = mean_val + 3 * std_val
            
            # Count outliers
            outliers = ((df[col] < lower_bound) | (df[col] > upper_bound)).sum()
            
            if outliers > 0:
                # Remove outliers
                df = df[(df[col] >= lower_bound) & (df[col] <= upper_bound)]
                print(f"  {col}: Removed {outliers} outliers (bounds: {lower_bound:.2f} to {upper_bound:.2f})")
                total_outliers_removed += outliers
            else:
                print(f"  {col}: No outliers found")
    
    print(f"✅ Total outliers removed: {total_outliers_removed}")
    print(f"Final shape: {df.shape}")
    
    # 12. Print final shape and null count
    print("\n📋 Final data analysis:")
    print(f"Final shape: {df.shape}")
    print("Final null counts:")
    final_nulls = df.isnull().sum()
    for col, null_count in final_nulls.items():
        if null_count > 0:
            print(f"  {col}: {null_count}")
        else:
            print(f"  {col}: ✅ No nulls")
    
    # 13. Save cleaned data to data/cleaned/aqi_cleaned.csv
    print("\n💾 Saving cleaned data...")
    output_path = Path("data/cleaned/aqi_cleaned.csv")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"✅ Saved cleaned data to: {output_path}")
    
    # 14. Print value_counts of risk_level to check class balance
    print("\n🎯 Final class balance:")
    if 'risk_level' in df.columns:
        risk_counts = df['risk_level'].value_counts()
        print("Risk level distribution:")
        for level, count in risk_counts.items():
            percentage = (count / len(df)) * 100
            print(f"  {level}: {count} ({percentage:.1f}%)")
    
    print("\n🎉 Data cleaning completed successfully!")
    print(f"📊 Processed {len(df)} clean records ready for ML modeling")

if __name__ == "__main__":
    main()