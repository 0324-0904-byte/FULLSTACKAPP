from django.db import models
from django.contrib.auth.hashers import make_password, check_password
from decimal import Decimal

class Category(models.Model):
    category_id = models.AutoField(primary_key=True, db_column="category_id")
    name = models.CharField(max_length=250, unique=True, db_column="category_name")
    image = models.ImageField(upload_to='main/css/admin/pics/', null=True, blank=True, db_column="category_image")

    class Meta:
        db_table = "category"
        managed = False

    def __str__(self):
        return self.name
    
class SubCategory(models.Model):
    subcategory_id = models.AutoField(primary_key=True, db_column="subcategory_id")
    name = models.CharField(max_length=250, unique=True, db_column="subcategory_name")
    category = models.ForeignKey(Category, on_delete=models.CASCADE, db_column="category_id")

    class Meta:
        db_table = "subcategory"
        managed = False 
        
    def __str__(self):
        return self.name

class Products(models.Model):
    item_id = models.AutoField(primary_key=True, db_column="product_id")
    item_name = models.CharField(max_length=250, db_column="product_name")
    item_quantity = models.IntegerField(db_column="product_quantity")
    item_description = models.CharField(max_length=500, db_column="product_description")
    item_price = models.DecimalField(max_digits=10, decimal_places=2, db_column="product_price")
    item_image = models.ImageField(upload_to='main/css/admin/pics/', db_column="product_image")
    item_category = models.ForeignKey(Category, on_delete=models.CASCADE, db_column="category_name")
    subcategory = models.ForeignKey(SubCategory, on_delete=models.SET_NULL, null=True, blank=True, db_column="subcategory_id")

    class Meta:
        db_table = "products_furniture"
        managed = False

    def __str__(self):
        return self.item_name


class Customers(models.Model):
    user_id = models.AutoField(primary_key=True, db_column="user_id")
    user_name = models.CharField(max_length=250, db_column="user_name")
    user_email = models.CharField(max_length=100, db_column="user_email", unique=True)
    user_password = models.CharField(max_length=25, db_column="user_password")

    class Meta:
        db_table = "customers"
        managed = False

    def __str__(self):
        return self.user_name
    def set_password(self, raw_password):
        self.password = make_password(raw_password)
        self.save()

    # helper method to check password
    def check_password(self, raw_password):
        return check_password(raw_password, self.password)