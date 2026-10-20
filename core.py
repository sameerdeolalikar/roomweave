"""Validated document model. Synthetic fixtures only."""
from datetime import date, timedelta
import re

def integer(value, low, high, label):
    if type(value) is not int or not low <= value <= high:
        raise ValueError(f"{label} must be an integer between {low} and {high}.")
    return value

def text(value, label, maximum=120):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise ValueError(f"{label} must contain 1–{maximum} characters.")
    return value.strip()

def choice(value, allowed, label):
    if value not in allowed:
        raise ValueError(f"Invalid {label}.")
    return value

def items(raw, key):
    result=raw.get(key)
    if not isinstance(result,list) or len(result)>150:
        raise ValueError(f"{key} must be a list of at most 150 entries.")
    seen=set()
    for item in result:
        if not isinstance(item,dict): raise ValueError("Each entry must be an object.")
        key_id=item.get("id")
        if not isinstance(key_id,str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,60}",key_id) or key_id in seen:
            raise ValueError("Entry identifiers must be unique and valid.")
        seen.add(key_id)
    return result

def base(raw):
    if not isinstance(raw,dict) or type(raw.get("version")) is not int or raw["version"]!=1:
        raise ValueError("Expected a version 1 document.")
    return {"version":1,"title":text(raw.get("title"),"Title")}
def validate(raw):
    out=base(raw);out["width"]=integer(raw.get("width"),1000,20000,"Room width");out["height"]=integer(raw.get("height"),1000,20000,"Room depth");out["objects"]=[]
    for x in items(raw,"objects"):
        obj={"id":x["id"],"name":text(x.get("name"),"Object name"),"x":integer(x.get("x"),0,20000,"X"),"y":integer(x.get("y"),0,20000,"Y"),"width":integer(x.get("width"),100,10000,"Object width"),"height":integer(x.get("height"),100,10000,"Object depth"),"clearance":integer(x.get("clearance"),0,1000,"Clearance"),"kind":choice(x.get("kind"),["work","storage","seating"],"object kind")}
        if obj["x"]+obj["width"]>out["width"] or obj["y"]+obj["height"]>out["height"]:raise ValueError("An object extends beyond the room boundary.")
        out["objects"].append(obj)
    return out

def analyze(doc):
    overlaps=[];clearance=[]
    for i,a in enumerate(doc["objects"]):
        for b in doc["objects"][i+1:]:
            def hit(g):return a["x"]<b["x"]+b["width"]+g and b["x"]<a["x"]+a["width"]+g and a["y"]<b["y"]+b["height"]+g and b["y"]<a["y"]+a["height"]+g
            if hit(0):overlaps.append([a["id"],b["id"]])
            elif hit(max(a["clearance"],b["clearance"])):clearance.append([a["id"],b["id"]])
    walls=[o["id"] for o in doc["objects"] if min(o["x"],o["y"],doc["width"]-o["x"]-o["width"],doc["height"]-o["y"]-o["height"])<o["clearance"]]
    return {"overlaps":overlaps,"clearance":clearance,"walls":walls,"metrics":{"Objects":len(doc["objects"]),"Overlaps":len(overlaps),"Clearance pairs":len(clearance),"Wall notices":len(walls)}}
