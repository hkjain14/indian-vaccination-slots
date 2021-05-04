# Indian-vaccination-slots

This app gives you following details about Covid-19 Indian vaccination slot availability for the next **7 days**:
1. No. of slots available at the center
2. Available Center
3. Pincode
4. Date of availability
5. Vaccine Provided at center

The app can be used for following requests:
1. **State** OR Pincode OR District name **(required)**
2. Age
3. **Vaccine preference** (optional)

### Results

By running the script once, you would be **AUTOMATICALLY INFORMED** (via an audio sound) as soon as an open slot is available for your age. 

Otherwise, the request is made again after **after every 5 seconds**, until available slots are obtained (or if the process is stopped manually).

### Prerequisites
Installing nodeJs : [here](https://nodejs.org/en/download/)

## How to use
1. Clone this repo.
   

2. Navigate to the repo's directory via terminal.

`cd indian-vaccination-slots/`


3. Provide pincode/district, age, vaccine preference (optional) by running the following :

### i) State wise :

`node index.js Delhi 24`

#### Structure of state's request:

_State in SentenceCase_.

For example : AndhraPradesh

### ii) Pincode wise : 

`node index.js 110006 60 covishield`

### iii) District wise :

`node index.js Delhi-NorthDelhi 45 covaxin`


#### Structure of district's request:  

_State-District in SentenceCase_.

For example : AndhraPradesh-EastGodavari

#### Note :

If no vaccine is specified, both the vaccines' results would be displayed.


## References
This script uses the API provided by the Government of India [here](https://apisetu.gov.in/public/marketplace/api/cowin).
