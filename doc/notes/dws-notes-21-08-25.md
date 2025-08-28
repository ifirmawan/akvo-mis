
# Table of Contents

1.  [Rural Water Project](#org3157a33)
    1.  [Rural Water Project (Registration)](#org6c6d136)
        1.  [Data Point Name: Project Name - Area - Village Name](#orgc28e8a6)
        2.  [Add](#org61b9ca6)
        3.  [Remove](#orgf2c6b31)
        4.  [Modify](#orgc40a727)
    2.  [Rural Water Project - Monitoring (Monitoring)](#orgd2f892a)
        1.  [Data Point Name: DWS Staff Name - Inspection Date](#orge654174)
        2.  [Add](#org7cc1115)
        3.  [Remove](#orga116f16)
        4.  [Modify](#org1d1b8ff)
2.  [EPS](#org3d21d1e)
    1.  [EPS Registration - (Registration)](#orgd90619a)
        1.  [Data Point Name: EPS Name - Area - Village Name](#orgcb3a6db)
        2.  [Add](#org97be01d)
        3.  [Remove](#org545f83e)
        4.  [Modify](#orgfd008fc)
    2.  [EPS Project Construction - (Monitoring)](#org0fd9fec)
        1.  [Data Point Name: DWS Staff Name - Inspection Date](#orgfa133b2)
        2.  [Add](#org1759d25)
        3.  [Remove](#orgea88db3)
        4.  [Modify](#orga74b483)
    3.  [EPS Water Quality Testing - (Monitoring)](#org3ac1e94)
        1.  [Add](#orgcf90129)
        2.  [Remove](#orgfd7723b)
        3.  [Modify](#org92c85ec)
3.  [Waste Water Plant](#orgeb882c0)
    1.  [Waste Water Plant Registration - (Registration)](#org1541ddd)
    2.  [Waste Water Plant Monitoring - (Monitoring)](#orgf2d6e12)
    3.  [Waste Water Plant Quick Monitoring - (Monitoring)](#orgf100b00)
4.  [Water Plant](#orga3021d1)
    1.  [Water Plant Registration - (Registration)](#orga0e2dab)
    2.  [Water Plant Monitoring - (Monitoring)](#org1884447)
    3.  [Water Plant Quick Monitoring - (Monitoring)](#org6f24332)
5.  [SPS (Waste Waterpump)](#orgecb20ff)
    1.  [Waste Water Pump Registration - (Registration)](#org2f247f4)
    2.  [Waste Water Pump Monitoring - (Monitoring)](#orgd098fcd)
    3.  [Waste Water Pump Quick Monitoring - (Monitoring)](#orgc1b965b)


<a id="org3157a33"></a>

# Rural Water Project


<a id="org6c6d136"></a>

## Rural Water Project (Registration)


<a id="orgc28e8a6"></a>

### Data Point Name: Project Name - Area - Village Name


<a id="org61b9ca6"></a>

### Add

1.  Who is the project Implementing agency/agencies?

2.  Is the WSMP submitted?

3.  Is the WSMP approved?

    Dependent on **Is the WSMP submitted?**

4.  Construction Start Date?

5.  Do you have Water Committee and Is it active? [Yes, Not Active, No]


<a id="orgf2c6b31"></a>

### Remove

1.  Sizes of Pipes

2.  Type of Water Source?

    and all the child dependencies [NOTE FOR DEV TEAM: Cross questionnaire dependencies]


<a id="orgc40a727"></a>

### Modify

1.  Remove Desalination Option on Type of Water Source


<a id="orgd2f892a"></a>

## Rural Water Project - Monitoring (Monitoring)


<a id="orge654174"></a>

### Data Point Name: DWS Staff Name - Inspection Date


<a id="org7cc1115"></a>

### Add

1.  Type of Water Source? (Options: pick from Registration)

2.  Which part of the construction sites you can visit?

    Dam, RAW water main, reservoir, distribution main, reticulation

3.  DAM (REPEAT) -> Will only show if Dam is selected

    1.  GPS Location (IF Possible take it from photo metadata)
    
    2.  Name of component
    
        Collecting Box
        Inlet Strainer
        2nd Outlet
        Screening
        Washout
        Spillway / Overflow
    
    3.  Photo
    
    4.  Description

4.  RAW WATER MAIN (REPEAT) -> Will only show if RAW Water Main is selected

    1.  GPS Location (IF Possible take it from photo metadata)
    
    2.  Name of component
    
        RAW Water Pipeline
        Air Valve
        Washout
    
    3.  Size of Pipe [200, 150, 100, 80, 50][Multiple] -> Dependency if RAW Water Pipeline Selected
    
    4.  Type of Pipe [PVC, Polyethelene][Multiple] -> Dependency if RAW Water Pipeline Selected
    
    5.  Photo
    
    6.  Description

5.  RESERVOIR (REPEAT) -> Will only show if RESERVOIR is selected

    1.  GPS Location (IF Possible take it from photo metadata)
    
    2.  Name of component
    
        Reservoir Inlet
        Reservoir Outlet
        Reservoir Overflow
        Reservoir Inspection Hatch
        Reservoir Breather
        Inlet Valve / Flowmeter Chamber
        Outlet Valve / Flowmeter Chamber
        Inspection Ladder
        Fencing
        Solar Lighting
        Gate and Lock
    
    3.  Size of Pipe [200, 150, 100, 80, 50][Multiple] -> Dependency if Inlet, Outlet and Overflow Selected
    
    4.  Type of Pipe [PVC, Polyethelene][Multiple] -> Dependency if Inlet, outlet, overflow Selected
    
    5.  Photo
    
    6.  Description

6.  DISTRIBUTION MAIN (REPEAT) -> Will only show if Distribution Main is selected

    1.  GPS Location (IF Possible take it from photo metadata)
    
    2.  Name of component
    
        Distribution Pipeline
        Air Valve
        Washout
    
    3.  Size of Pipe [200, 150, 100, 80, 50][Multiple] -> Dependency if Distribution Pipeline Selected
    
    4.  Type of Pipe [PVC, Polyethelene][Multiple] -> Dependency if Distribution Pipeline Selected
    
    5.  Length of Pipe -> Dependency if Distribution Pipeline Selected
    
    6.  Photo
    
    7.  Description

7.  RETICULATION (REPEAT) -> Will only show if reticulation  is selected

    1.  GPS Location (IF Possible take it from photo metadata)
    
    2.  Name of component
    
        Reticulation pipeline
        Washout
        Household Connections
    
    3.  Size of Pipe [200, 150, 100, 80, 50][Multiple] -> Dependency if Reticulation Pipeline Selected
    
    4.  Type of Pipe [PVC, Polyethelene][Multiple] -> Dependency if Reticulation Pipeline Selected
    
    5.  Type of Connnection [Household, Shared][Multiple] -> Dependency if Household Connections
    
    6.  Number of Household Connection -> Dependency if Household
    
    7.  Number of Shared Connection -> Dependency if Shared
    
    8.  Photo
    
    9.  Description


<a id="orga116f16"></a>

### Remove

1.  What type of pipes have been used?

2.  Who is the project Implementing agency/agencies?

3.  Is the WSMP submitted?

4.  Is the WSMP approved?

5.  Construction Start Date?

6.  Locality Plan

7.  Project Photos QG


<a id="org1d1b8ff"></a>

### Modify

1.  Is there any improvement action to be taken by the implementing agency? (wording: add From the last inspection)


<a id="org3d21d1e"></a>

# EPS


<a id="orgd90619a"></a>

## EPS Registration - (Registration)


<a id="orgcb3a6db"></a>

### Data Point Name: EPS Name - Area - Village Name


<a id="org97be01d"></a>

### Add

1.  Do you have Water Committee and Is it active? [Yes, Not Active, No]


<a id="org545f83e"></a>

### Remove

1.  Type of Water Source

2.  Do you have Water Committee?

3.  Is the Water Comittee Active?


<a id="orgfd008fc"></a>

### Modify

1.  Implementing Agency Type Other


<a id="org0fd9fec"></a>

## EPS Project Construction - (Monitoring)


<a id="orgfa133b2"></a>

### Data Point Name: DWS Staff Name - Inspection Date


<a id="org1759d25"></a>

### Add

1.  Inspection Date

2.  Use RURAL PROJECT GENERAL REMARKS, except Implementing Agency


<a id="orgea88db3"></a>

### Remove

1.  Locality Plan


<a id="orga74b483"></a>

### Modify

1.  FOR ALL THE QUESTIONS IN THE PROJECT SCOPE QG:

    1.  PROJECT SCOPE: BREAK DOWN @NEMANI
    
    2.  REPATABLE PHOTO ON PROJECT SCOPE


<a id="org3ac1e94"></a>

## EPS Water Quality Testing - (Monitoring)


<a id="orgcf90129"></a>

### Add

1.  Has the EPS Training been conducted in the Village? [Yes, No]


<a id="orgfd7723b"></a>

### Remove


<a id="org92c85ec"></a>

### Modify


<a id="orgeb882c0"></a>

# Waste Water Plant


<a id="org1541ddd"></a>

## Waste Water Plant Registration - (Registration)


<a id="orgf2d6e12"></a>

## Waste Water Plant Monitoring - (Monitoring)


<a id="orgf100b00"></a>

## Waste Water Plant Quick Monitoring - (Monitoring)


<a id="orga3021d1"></a>

# Water Plant


<a id="orga0e2dab"></a>

## Water Plant Registration - (Registration)


<a id="org1884447"></a>

## Water Plant Monitoring - (Monitoring)


<a id="org6f24332"></a>

## Water Plant Quick Monitoring - (Monitoring)


<a id="orgecb20ff"></a>

# SPS (Waste Waterpump)


<a id="org2f247f4"></a>

## Waste Water Pump Registration - (Registration)


<a id="orgd098fcd"></a>

## Waste Water Pump Monitoring - (Monitoring)


<a id="orgc1b965b"></a>

## Waste Water Pump Quick Monitoring - (Monitoring)

