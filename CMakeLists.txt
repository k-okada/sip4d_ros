cmake_minimum_required(VERSION 3.0.2)
project(sip4d_ros)

find_package(catkin REQUIRED)

catkin_package()

# Install scripts
catkin_install_python(PROGRAMS
  scripts/create_sip4d_zip.py
  scripts/create_drone_sip4d_zip.py
  scripts/bag2sip4d_converter.py
  DESTINATION ${CATKIN_PACKAGE_BIN_DESTINATION}
)

# Install launch files
install(DIRECTORY launch/
  DESTINATION ${CATKIN_PACKAGE_SHARE_DESTINATION}/launch
)
